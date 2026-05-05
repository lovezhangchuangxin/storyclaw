use axum::{
    body::Body,
    extract::State,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    Json,
};
use futures::StreamExt;
use serde_json::Value;

use crate::auth::handlers::AppState;
use crate::auth::middleware::AuthUser;
use crate::error::AppError;
use crate::llm::{audit, usage};
use crate::rate_limit::RateLimitResult;
use crate::{crypto, rate_limit::QuotaResult};
use crate::routes::models::get_model_by_id;

pub async fn chat_completions(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Json(body): Json<Value>,
) -> Result<Response, AppError> {
    // --- Phase 1: Extract request parameters ---
    let is_stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let model_id = body
        .get("model_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<uuid::Uuid>().ok())
        .ok_or_else(|| AppError::Validation("model_id is required".into()))?;

    // --- Phase 2: Model access check ---
    let model = get_model_by_id(&state.pool, model_id).await?;
    let is_admin = auth_user.role == "admin";
    if !model.is_public && !is_admin && model.created_by != auth_user.user_id {
        return Err(AppError::Forbidden);
    }

    // --- Phase 3: Rate limit check ---
    if let RateLimitResult::Denied { retry_after_secs } = state
        .rate_limiter
        .check_rate_limit(auth_user.user_id, state.config.rate_limit_per_minute, 60)
        .await
    {
        tracing::warn!(
            user_id = %auth_user.user_id,
            retry_after = retry_after_secs,
            "Rate limit exceeded"
        );
        return Err(AppError::RateLimited);
    }

    // --- Phase 4: Quota pre-check (atomic check-and-reserve) ---
    let estimated_tokens = usage::estimate_prompt_tokens(&body);
    match state
        .rate_limiter
        .check_daily_quota(auth_user.user_id, estimated_tokens, state.config.daily_token_limit)
        .await
    {
        QuotaResult::Exceeded { limit, used } => {
            tracing::warn!(
                user_id = %auth_user.user_id,
                used,
                limit,
                "Daily token quota exceeded"
            );
            return Err(AppError::QuotaExceeded { limit, used });
        }
        QuotaResult::Allowed => {}
    }

    // --- Phase 5: Forward to upstream LLM ---
    let api_key = crypto::decrypt(&model.api_key_encrypted, &state.config.model_key)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("Failed to decrypt API key")))?;

    // Build a clean request body: override model, remove internal fields
    let mut forward_body = body.clone();
    forward_body["model"] = Value::String(model.model.clone());
    if let Some(obj) = forward_body.as_object_mut() {
        obj.remove("model_id");
    }

    let resp = state
        .http_client
        .post(format!("{}/chat/completions", model.api_base))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&forward_body)
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        let preview: String = text.chars().take(500).collect();
        tracing::error!("Upstream LLM error: {} - {}", status, preview);
        // Roll back pre-reserved quota since the request failed
        state
            .rate_limiter
            .adjust_daily_usage(auth_user.user_id, estimated_tokens, 0)
            .await;
        return Err(AppError::Internal(anyhow::anyhow!(
            "Upstream LLM request failed (status {})",
            status
        )));
    }

    // --- Phase 6: Handle response ---
    if !is_stream {
        let data: Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;

        let (prompt_tokens, completion_tokens) = extract_usage_from_response(&data);
        let total = prompt_tokens + completion_tokens;

        // Adjust quota: correct the pre-reservation with actual usage
        state
            .rate_limiter
            .adjust_daily_usage(auth_user.user_id, estimated_tokens, total)
            .await;

        spawn_audit(
            state.pool.clone(),
            auth_user.user_id,
            model_id,
            &model.model,
            prompt_tokens,
            completion_tokens,
            total,
            false,
        );

        return Ok((StatusCode::OK, Json(data)).into_response());
    }

    // Streaming: wrap stream with usage inspection
    let (inspect_stream, usage_captured) = usage::UsageInspectStream::new(
        resp.bytes_stream().map(|chunk| match chunk {
            Ok(bytes) => Ok(bytes),
            Err(e) => {
                tracing::error!("Stream error: {}", e);
                Err(std::io::Error::other(e))
            }
        }),
    );

    let pool = state.pool.clone();
    let rate_limiter = state.rate_limiter.clone();
    let user_id = auth_user.user_id;
    let estimated = estimated_tokens;

    let accounting_stream = usage::AccountingStream::new(inspect_stream, move || {
        let (prompt_tokens, completion_tokens) =
            usage::unpack_usage(usage_captured.load(std::sync::atomic::Ordering::SeqCst));
        let total = prompt_tokens + completion_tokens;

        tokio::spawn(async move {
            // If actual tokens captured, adjust from pre-reservation;
            // otherwise keep the pre-reserved estimate
            let actual = if total > 0 { total } else { estimated };
            rate_limiter
                .adjust_daily_usage(user_id, estimated, actual)
                .await;

            spawn_audit(
                pool,
                user_id,
                model_id,
                &model.model,
                prompt_tokens,
                completion_tokens,
                actual,
                true,
            );
        });
    });

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header("X-Accel-Buffering", "no")
        .body(Body::from_stream(accounting_stream))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to build SSE response: {}", e)))
}

fn spawn_audit(
    pool: sqlx::PgPool,
    user_id: uuid::Uuid,
    model_id: uuid::Uuid,
    model_name: &str,
    prompt_tokens: i64,
    completion_tokens: i64,
    total_tokens: i64,
    is_stream: bool,
) {
    audit::spawn_audit_log(
        pool,
        audit::AuditEntry {
            user_id,
            backend_model_id: model_id,
            model_name: model_name.to_string(),
            prompt_tokens: prompt_tokens as i32,
            completion_tokens: completion_tokens as i32,
            total_tokens: total_tokens as i32,
            is_stream,
        },
    );
}

fn extract_usage_from_response(data: &Value) -> (i64, i64) {
    let usage = data.get("usage");
    let prompt = usage
        .and_then(|u| u.get("prompt_tokens"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    let completion = usage
        .and_then(|u| u.get("completion_tokens"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);
    (prompt, completion)
}

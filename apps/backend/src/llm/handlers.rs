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
use crate::routes::models;
use crate::crypto;

pub async fn chat_completions(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Json(body): Json<Value>,
) -> Result<Response, AppError> {
    let is_stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let model_id = body
        .get("model_id")
        .and_then(|v| v.as_str())
        .and_then(|s| s.parse::<uuid::Uuid>().ok());

    let (upstream_url, api_key) = if let Some(id) = model_id {
        let model = models::get_model_by_id(&state.pool, id).await?;
        let key = crypto::decrypt(&model.api_key_encrypted, &state.config.model_key)
            .map_err(|_| AppError::Internal(anyhow::anyhow!("Failed to decrypt API key")))?;
        (model.api_base, key)
    } else {
        return Err(AppError::Validation("model_id is required".into()));
    };

    let resp = state
        .http_client
        .post(format!("{}/chat/completions", upstream_url))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        tracing::error!("Upstream LLM error: {} - {}", status, text);
        return Err(AppError::Internal(anyhow::anyhow!(
            "Upstream LLM request failed (status {})",
            status
        )));
    }

    if !is_stream {
        let data: Value = resp
            .json()
            .await
            .map_err(|e| AppError::Internal(e.into()))?;
        return Ok((StatusCode::OK, Json(data)).into_response());
    }

    let stream = resp
        .bytes_stream()
        .map(|chunk| match chunk {
            Ok(bytes) => Ok(bytes),
            Err(e) => {
                tracing::error!("Stream error: {}", e);
                Err(std::io::Error::other(e))
            }
        });

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header("X-Accel-Buffering", "no")
        .body(Body::from_stream(stream))
        .map_err(|e| AppError::Internal(anyhow::anyhow!("Failed to build SSE response: {}", e)))
}

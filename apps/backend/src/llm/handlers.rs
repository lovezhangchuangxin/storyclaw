use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response, sse::{Event, Sse}},
    Json,
};
use futures::StreamExt;
use serde_json::Value;

use crate::auth::handlers::AppState;
use crate::auth::middleware::AuthUser;
use crate::error::AppError;

pub async fn chat_completions(
    State(state): State<AppState>,
    _auth_user: AuthUser,
    Json(body): Json<Value>,
) -> Result<Response, AppError> {
    let is_stream = body
        .get("stream")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let resp = state
        .http_client
        .post(format!("{}/chat/completions", state.llm_api_base))
        .header("Authorization", format!("Bearer {}", state.llm_api_key))
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| AppError::Internal(e.into()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AppError::Internal(anyhow::anyhow!(
            "Upstream LLM error: {} - {}",
            status,
            text
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
            Ok(bytes) => {
                let text = String::from_utf8_lossy(&bytes).to_string();
                Ok(Event::default().data(text))
            }
            Err(e) => {
                tracing::error!("SSE stream error: {}", e);
                Err(axum::Error::new(e))
            }
        });

    Ok(Sse::new(stream).into_response())
}

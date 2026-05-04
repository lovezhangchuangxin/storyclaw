use axum::{routing::post, Router};

use crate::auth::handlers::AppState;
use crate::llm::handlers;

pub fn llm_routes(state: AppState) -> Router {
    Router::new()
        .route("/v1/chat/completions", post(handlers::chat_completions))
        .route("/chat", post(handlers::chat_completions))
        .with_state(state)
}


use axum::{routing::{get, post}, Router};

use crate::auth::handlers::AppState;
use crate::sync::handlers;

pub fn sync_routes(state: AppState) -> Router {
    Router::new()
        .route("/", get(handlers::list_novels))
        .route("/{id}/push", post(handlers::push_novel))
        .route("/{id}/pull", get(handlers::pull_novel))
        .route("/{id}", axum::routing::delete(handlers::delete_novel))
        .with_state(state)
}

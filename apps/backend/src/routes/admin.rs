use axum::{routing::get, Router};

use crate::auth::handlers::AppState;
use crate::admin::handlers;

pub fn admin_routes(state: AppState) -> Router {
    Router::new()
        .route("/users", get(handlers::list_users))
        .route("/users/{id}", get(handlers::get_user))
        .route("/novels", get(handlers::list_novels))
        .route("/stats", get(handlers::get_stats))
        .with_state(state)
}

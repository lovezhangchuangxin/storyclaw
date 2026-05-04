use axum::{routing::post, Router};

use crate::auth::handlers::{self, AppState};

pub fn auth_routes(state: AppState) -> Router {
    Router::new()
        .route("/register", post(handlers::register))
        .route("/login", post(handlers::login))
        .route("/refresh", post(handlers::refresh))
        .with_state(state)
}

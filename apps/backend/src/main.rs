mod config;
mod crypto;
mod error;
mod db;
mod routes;
mod models;
mod auth;
mod sync;
mod llm;
mod admin;
mod rate_limit;

use axum::{routing::get, Router, http::{Method, header}};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use crate::auth::handlers::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "storyclaw_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = config::Config::from_env()?;
    tracing::info!("Starting StoryClaw backend on port {}", config.port);

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Migrations applied");

    let http_client = reqwest::Client::new();

    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        http_client,
    };

    let cors_origin = config.cors_origin
        .parse::<axum::http::HeaderValue>()
        .unwrap_or_else(|_| "http://localhost:5173".parse().unwrap());

    let cors = CorsLayer::new()
        .allow_origin(cors_origin)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
        .allow_credentials(true);
    let auth_router = routes::auth::auth_routes(state.clone());
    let novels_router = routes::novels::sync_routes(state.clone());
    let llm_router = routes::llm::llm_routes(state.clone());
    let models_router = routes::models::models_routes(state.clone());
    let admin_router = routes::admin::admin_routes(state);

    let app = Router::new()
        .route("/api/health", get(routes::health::health_check))
        .nest("/api/auth", auth_router)
        .nest("/api/novels", novels_router)
        .nest("/api/llm", llm_router)
        .nest("/api/models", models_router)
        .nest("/api/admin", admin_router)
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!("Listening on {}", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("Shutdown signal received");
}

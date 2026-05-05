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

use axum::{routing::get, Router, http::Method};
use std::net::SocketAddr;
use std::time::Duration;
use tower_http::cors::{Any, CorsLayer};
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

    let http_client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .read_timeout(Duration::from_secs(120))
        .build()?;

    let rate_limiter = rate_limit::RateLimiter::new(config.redis_url.clone());
    if let Err(e) = rate_limiter.connect().await {
        tracing::warn!("Redis connection failed, rate limiting disabled: {}", e);
    }

    let state = AppState {
        pool: pool.clone(),
        config: config.clone(),
        http_client,
        rate_limiter,
    };

    // Background task: periodically clean up old device fingerprints
    {
        let pool = pool.clone();
        let retention_days = config.fingerprint_retention_days;
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(6 * 3600));
            loop {
                interval.tick().await;
                match sqlx::query(
                    "DELETE FROM device_fingerprints WHERE created_at < NOW() - make_interval(days => $1::int)",
                )
                .bind(retention_days)
                .execute(&pool)
                .await
                {
                    Ok(result) => {
                        if result.rows_affected() > 0 {
                            tracing::info!("Cleaned up {} old fingerprint records", result.rows_affected());
                        }
                    }
                    Err(e) => tracing::warn!("Fingerprint cleanup failed: {}", e),
                }
            }
        });
    }

    let cors_origin = config.cors_origin
        .parse::<axum::http::HeaderValue>()
        .unwrap_or_else(|_| "http://localhost:5173".parse().unwrap());

    let cors = CorsLayer::new()
        .allow_origin(cors_origin)
        .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
        .allow_headers(Any);
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

    axum::serve(listener, app.into_make_service_with_connect_info::<SocketAddr>())
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

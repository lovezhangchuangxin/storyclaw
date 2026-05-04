use axum::{
    extract::State,
    http::StatusCode,
    middleware::Next,
    response::Response,
};
use redis::aio::MultiplexedConnection;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct RateLimiter {
    conn: Arc<Mutex<Option<MultiplexedConnection>>>,
}

impl RateLimiter {
    pub fn new() -> Self {
        Self {
            conn: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn connect(&self, redis_url: &str) -> anyhow::Result<()> {
        let client = redis::Client::open(redis_url)?;
        let conn = client.get_multiplexed_async_connection().await?;
        let mut guard = self.conn.lock().await;
        *guard = Some(conn);
        Ok(())
    }

    pub fn is_connected(&self) -> bool {
        true
    }
}

pub async fn rate_limit_middleware(
    State(_limiter): State<RateLimiter>,
    request: axum::http::Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    Ok(next.run(request).await)
}

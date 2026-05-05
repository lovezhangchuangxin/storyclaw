use sqlx::PgPool;
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> anyhow::Result<PgPool> {
    let max_attempts = 5;
    for attempt in 1..=max_attempts {
        match sqlx::postgres::PgPoolOptions::new()
            .max_connections(20)
            .acquire_timeout(Duration::from_secs(30))
            .connect(database_url)
            .await
        {
            Ok(pool) => return Ok(pool),
            Err(e) if attempt < max_attempts => {
                tracing::warn!("Database connection attempt {attempt}/{max_attempts} failed: {e}");
                tokio::time::sleep(Duration::from_secs(2)).await;
            }
            Err(e) => return Err(e.into()),
        }
    }
    unreachable!()
}

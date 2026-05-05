use chrono::Utc;
use redis::aio::MultiplexedConnection;
use std::sync::Arc;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct RateLimiter {
    conn: Arc<Mutex<Option<MultiplexedConnection>>>,
    redis_url: Arc<str>,
}

pub enum RateLimitResult {
    Allowed,
    Denied { retry_after_secs: i64 },
}

pub enum QuotaResult {
    Allowed,
    Exceeded { limit: i64, used: i64 },
}

impl RateLimiter {
    pub fn new(redis_url: String) -> Self {
        Self {
            conn: Arc::new(Mutex::new(None)),
            redis_url: redis_url.into(),
        }
    }

    pub async fn connect(&self) -> anyhow::Result<()> {
        let client = redis::Client::open(self.redis_url.as_ref())?;
        let conn = client.get_multiplexed_async_connection().await?;
        let mut guard = self.conn.lock().await;
        *guard = Some(conn);
        Ok(())
    }

    /// Attempt lazy reconnection if not connected.
    async fn get_conn(&self) -> Option<MultiplexedConnection> {
        {
            let guard = self.conn.lock().await;
            if guard.is_some() {
                return guard.clone();
            }
        }
        // Try to reconnect
        tracing::warn!("Redis not connected, attempting reconnect");
        if self.connect().await.is_ok() {
            tracing::info!("Redis reconnected successfully");
        }
        self.conn.lock().await.clone()
    }

    /// Sliding-window rate limit using a Redis sorted set.
    /// Key: `rl:{user_id}`, score = timestamp, value = unique member.
    pub async fn check_rate_limit(
        &self,
        user_id: Uuid,
        limit: i32,
        window_secs: i64,
    ) -> RateLimitResult {
        let mut conn = match self.get_conn().await {
            Some(c) => c,
            None => return RateLimitResult::Allowed, // degraded mode
        };

        let key = format!("rl:{user_id}");
        let now = Utc::now().timestamp_millis();
        let window_start = now - (window_secs * 1000);
        let member = format!("{}:{}", now, Uuid::new_v4());

        // Atomic Lua script: prune expired, count, conditionally add, set correct TTL
        let script = redis::Script::new(
            r"
            redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])
            local count = redis.call('ZCARD', KEYS[1])
            if count < tonumber(ARGV[2]) then
                redis.call('ZADD', KEYS[1], ARGV[3], ARGV[4])
                redis.call('EXPIRE', KEYS[1], ARGV[5])
            end
            return count
            ",
        );

        let count: i64 = script
            .key(&key)
            .arg(window_start)
            .arg(limit)
            .arg(now)
            .arg(&member)
            .arg(window_secs)
            .invoke_async(&mut conn)
            .await
            .unwrap_or(-1);

        if count < 0 {
            tracing::warn!("Redis rate limit check failed, allowing request");
            return RateLimitResult::Allowed;
        }

        if count >= limit as i64 {
            RateLimitResult::Denied {
                retry_after_secs: window_secs,
            }
        } else {
            RateLimitResult::Allowed
        }
    }

    /// Atomically check daily token quota and reserve estimated tokens.
    /// Key: `quota:{user_id}:{YYYY-MM-DD}`
    pub async fn check_daily_quota(
        &self,
        user_id: Uuid,
        estimated_tokens: i64,
        daily_limit: i64,
    ) -> QuotaResult {
        let mut conn = match self.get_conn().await {
            Some(c) => c,
            None => return QuotaResult::Allowed,
        };

        let today = Utc::now().format("%Y-%m-%d").to_string();
        let key = format!("quota:{user_id}:{today}");

        // Atomic Lua: check + reserve in one round-trip
        let script = redis::Script::new(
            r"
            local current = tonumber(redis.call('GET', KEYS[1]) or '0')
            local requested = tonumber(ARGV[1])
            local limit = tonumber(ARGV[2])
            if current + requested > limit then
                return {0, current, limit}
            end
            local new_val = redis.call('INCRBY', KEYS[1], requested)
            redis.call('EXPIRE', KEYS[1], 172800)
            return {1, new_val, limit}
            ",
        );

        let result: Vec<i64> = script
            .key(&key)
            .arg(estimated_tokens)
            .arg(daily_limit)
            .invoke_async(&mut conn)
            .await
            .unwrap_or_else(|_| vec![1, 0, daily_limit]);

        if result[0] == 0 {
            QuotaResult::Exceeded {
                limit: result[2],
                used: result[1],
            }
        } else {
            QuotaResult::Allowed
        }
    }

    /// Adjust the daily usage counter after actual token consumption is known.
    /// This corrects the pre-reservation from check_daily_quota.
    pub async fn adjust_daily_usage(
        &self,
        user_id: Uuid,
        estimated_tokens: i64,
        actual_tokens: i64,
    ) {
        let mut conn = match self.get_conn().await {
            Some(c) => c,
            None => return,
        };

        let diff = actual_tokens - estimated_tokens;
        if diff == 0 {
            return;
        }

        let today = Utc::now().format("%Y-%m-%d").to_string();
        let key = format!("quota:{user_id}:{today}");

        if diff > 0 {
            let _: Result<(), _> = redis::cmd("INCRBY")
                .arg(&key)
                .arg(diff)
                .query_async(&mut conn)
                .await;
        } else {
            // Decrement by the negative diff
            let _: Result<(), _> = redis::cmd("DECRBY")
                .arg(&key)
                .arg(-diff)
                .query_async(&mut conn)
                .await;
        }
    }
}

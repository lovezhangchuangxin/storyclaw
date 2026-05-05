use secrecy::SecretString;

#[derive(Clone)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: SecretString,
    pub port: u16,
    pub cors_origin: String,
    pub model_key: [u8; 32],
    pub daily_token_limit: i64,
    pub rate_limit_per_minute: i32,
}

fn require_env(key: &str) -> String {
    std::env::var(key).unwrap_or_else(|_| {
        panic!("{key} must be set in production (STORYCLAW_PRODUCTION=1)")
    })
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let is_production = std::env::var("STORYCLAW_PRODUCTION")
            .map(|v| v == "1")
            .unwrap_or(false);

        let model_key_hex = if is_production {
            require_env("MODEL_ENCRYPTION_KEY")
        } else {
            std::env::var("MODEL_ENCRYPTION_KEY")
                .unwrap_or_else(|_| "0000000000000000000000000000000000000000000000000000000000000000".to_string())
        };

        let key_bytes = hex::decode(&model_key_hex)
            .map_err(|_| anyhow::anyhow!("MODEL_ENCRYPTION_KEY must be 64 hex characters (32 bytes)"))?;
        let mut model_key = [0u8; 32];
        model_key.copy_from_slice(&key_bytes);

        let jwt_secret = {
            let secret = if is_production {
                require_env("JWT_SECRET")
            } else {
                std::env::var("JWT_SECRET")
                    .unwrap_or_else(|_| "change-me-in-production-use-a-random-64-char-string".to_string())
            };
            SecretString::new(secret.into_boxed_str())
        };

        Ok(Self {
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://localhost:5432/storyclaw".to_string()),
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret,
            port: std::env::var("PORT")
                .unwrap_or_else(|_| "3000".to_string())
                .parse()
                .unwrap_or(3000),
            cors_origin: std::env::var("CORS_ORIGIN")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
            model_key,
            daily_token_limit: std::env::var("DAILY_TOKEN_LIMIT")
                .unwrap_or_else(|_| "1000000".to_string())
                .parse()
                .unwrap_or(1_000_000)
                .max(1),
            rate_limit_per_minute: std::env::var("RATE_LIMIT_RPM")
                .unwrap_or_else(|_| "20".to_string())
                .parse()
                .unwrap_or(20)
                .max(1),
        })
    }
}

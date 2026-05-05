use axum::extract::ConnectInfo;
use axum::http::HeaderMap;
use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use std::net::SocketAddr;
use uuid::Uuid;

use crate::config::Config;
use crate::error::{AppError, Result};
use crate::models::User;
use crate::rate_limit::RateLimiter;

use super::{jwt, password};

fn extract_client_ip(headers: &HeaderMap, addr: &SocketAddr) -> String {
    headers
        .get("x-real-ip")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .or_else(|| {
            headers
                .get("x-forwarded-for")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.split(',').next())
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| addr.ip().to_string())
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub fingerprint: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct RefreshRequest {
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub user: UserInfo,
    pub access_token: String,
    pub refresh_token: String,
}

#[derive(Debug, Serialize)]
pub struct UserInfo {
    pub id: Uuid,
    pub email: String,
    pub role: String,
}

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub http_client: reqwest::Client,
    pub rate_limiter: RateLimiter,
}

pub async fn register(
    State(state): State<AppState>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    if req.email.is_empty() || !req.email.contains('@') {
        return Err(AppError::Validation("Invalid email format".into()));
    }
    if req.password.len() < 6 {
        return Err(AppError::Validation("Password must be at least 6 characters".into()));
    }

    let ip = extract_client_ip(&headers, &addr);

    // Validate fingerprint format
    let valid_fp = req.fingerprint.as_ref().and_then(|fp| {
        if !fp.is_empty() && fp.len() <= 64 && fp.chars().all(|c| c.is_ascii_hexdigit()) {
            Some(fp.as_str())
        } else {
            None
        }
    });

    // IP rate limit check
    let window_secs = state.config.register_ip_window_hours * 3600;
    match state.rate_limiter.check_ip_rate_limit(&ip, state.config.register_ip_limit, window_secs).await {
        crate::rate_limit::RateLimitResult::Denied { .. } => {
            return Err(AppError::TooManyRegistrations);
        }
        crate::rate_limit::RateLimitResult::Allowed => {}
    }

    // Transaction: fingerprint check + user creation + fingerprint record
    let mut tx = state.pool.begin().await?;

    // Fingerprint check with advisory lock to prevent race conditions
    if let Some(fp) = valid_fp {
        let fp_hash: i64 = fp.bytes().fold(0i64, |acc, b| {
            acc.wrapping_mul(31).wrapping_add(b as i64)
        });
        sqlx::query("SELECT pg_advisory_xact_lock($1)")
            .bind(fp_hash)
            .execute(&mut *tx)
            .await?;

        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT user_id) FROM device_fingerprints WHERE fingerprint = $1",
        )
        .bind(fp)
        .fetch_one(&mut *tx)
        .await?;

        if count >= state.config.register_fingerprint_limit as i64 {
            return Err(AppError::SuspiciousRegistration);
        }
    }

    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_one(&mut *tx)
        .await?;

    if existing > 0 {
        return Err(AppError::Conflict("Email already registered".into()));
    }

    let password_hash = password::hash_password(&req.password)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;

    let user = sqlx::query_as::<_, User>(
        "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING *",
    )
    .bind(&req.email)
    .bind(&password_hash)
    .fetch_one(&mut *tx)
    .await?;

    // Record device fingerprint
    if let Some(fp) = valid_fp {
        sqlx::query(
            "INSERT INTO device_fingerprints (fingerprint, user_id, ip_address) VALUES ($1, $2, $3)",
        )
        .bind(fp)
        .bind(user.id)
        .bind(&ip)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;

    let access_token = jwt::create_access_token(user.id, &user.email, &user.role, &state.config)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    let refresh_token = jwt::create_refresh_token();

    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    )
    .bind(user.id)
    .bind(&refresh_token)
    .execute(&state.pool)
    .await?;

    Ok(Json(AuthResponse {
        user: UserInfo {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        access_token,
        refresh_token,
    }))
}

pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_optional(&state.pool)
        .await?
        .ok_or(AppError::Unauthorized)?;

    let valid = password::verify_password(&req.password, &user.password_hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;

    if !valid {
        return Err(AppError::Unauthorized);
    }

    let access_token = jwt::create_access_token(user.id, &user.email, &user.role, &state.config)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    let refresh_token = jwt::create_refresh_token();

    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    )
    .bind(user.id)
    .bind(&refresh_token)
    .execute(&state.pool)
    .await?;

    Ok(Json(AuthResponse {
        user: UserInfo {
            id: user.id,
            email: user.email,
            role: user.role,
        },
        access_token,
        refresh_token,
    }))
}

pub async fn refresh(
    State(state): State<AppState>,
    Json(req): Json<RefreshRequest>,
) -> Result<Json<AuthResponse>> {
    let row = sqlx::query(
        "UPDATE refresh_tokens SET is_used = TRUE \
         WHERE token = $1 AND is_used = FALSE AND expires_at > NOW() \
         RETURNING user_id",
    )
    .bind(&req.refresh_token)
    .fetch_optional(&state.pool)
    .await?;

    let Some(row) = row else {
        let reused = sqlx::query_scalar::<_, bool>(
            "SELECT is_used FROM refresh_tokens WHERE token = $1",
        )
        .bind(&req.refresh_token)
        .fetch_optional(&state.pool)
        .await?;

        if reused == Some(true) {
            sqlx::query("DELETE FROM refresh_tokens WHERE token = $1")
                .bind(&req.refresh_token)
                .execute(&state.pool)
                .await?;
        }
        return Err(AppError::Unauthorized);
    };

    let user_id: Uuid = row.get(0);

    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::Unauthorized)?;

    let access_token = jwt::create_access_token(user.id, &user.email, &user.role, &state.config)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e.to_string())))?;
    let new_refresh = jwt::create_refresh_token();

    sqlx::query(
        "INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL '30 days')",
    )
    .bind(user_id)
    .bind(&new_refresh)
    .execute(&state.pool)
    .await?;

    Ok(Json(AuthResponse {
        user: UserInfo { id: user.id, email: user.email, role: user.role },
        access_token,
        refresh_token: new_refresh,
    }))
}

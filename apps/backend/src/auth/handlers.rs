use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};
use uuid::Uuid;

use crate::config::Config;
use crate::error::{AppError, Result};
use crate::models::User;

use super::{jwt, password};

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
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
}

pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    if req.email.is_empty() || !req.email.contains('@') {
        return Err(AppError::Validation("Invalid email format".into()));
    }
    if req.password.len() < 6 {
        return Err(AppError::Validation("Password must be at least 6 characters".into()));
    }

    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE email = $1")
        .bind(&req.email)
        .fetch_one(&state.pool)
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
    .fetch_one(&state.pool)
    .await?;

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

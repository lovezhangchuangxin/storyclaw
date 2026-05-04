use std::sync::OnceLock;

use axum::{
    extract::FromRequestParts,
    http::request::Parts,
    http::header::AUTHORIZATION,
};
use secrecy::ExposeSecret;
use uuid::Uuid;

use crate::config::Config;
use crate::error::AppError;

use super::jwt;

static JWT_SECRET: OnceLock<Vec<u8>> = OnceLock::new();

fn get_jwt_secret() -> &'static [u8] {
    JWT_SECRET.get_or_init(|| {
        Config::from_env()
            .map(|c| c.jwt_secret.expose_secret().as_bytes().to_vec())
            .unwrap_or_default()
    })
}

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub email: String,
    pub role: String,
}

fn extract_bearer_token(parts: &Parts) -> Option<&str> {
    let header = parts.headers.get(AUTHORIZATION)?;
    let value = header.to_str().ok()?;
    value.strip_prefix("Bearer ")
}

impl<S> FromRequestParts<S> for AuthUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> std::result::Result<Self, Self::Rejection> {
        let token = extract_bearer_token(parts).ok_or(AppError::Unauthorized)?;
        let claims = jwt::verify_access_token(token, get_jwt_secret())
            .map_err(|_| AppError::Unauthorized)?;

        Ok(AuthUser {
            user_id: claims.sub,
            email: claims.email,
            role: claims.role,
        })
    }
}

#[derive(Debug, Clone)]
pub struct AdminUser(pub AuthUser);

impl<S> FromRequestParts<S> for AdminUser
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> std::result::Result<Self, Self::Rejection> {
        let user = AuthUser::from_request_parts(parts, state).await?;
        if user.role != "admin" {
            return Err(AppError::Forbidden);
        }
        Ok(AdminUser(user))
    }
}

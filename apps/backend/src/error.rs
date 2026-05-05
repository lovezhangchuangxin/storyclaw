use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Resource not found")]
    NotFound,

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Forbidden")]
    Forbidden,

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Too many requests")]
    RateLimited,

    #[error("Token quota exceeded: used {used}/{limit}")]
    QuotaExceeded { limit: i64, used: i64 },

    #[error("Internal server error")]
    Internal(#[from] anyhow::Error),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

#[derive(Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_type) = match &self {
            AppError::NotFound => (StatusCode::NOT_FOUND, "not_found"),
            AppError::Validation(_) => (StatusCode::BAD_REQUEST, "validation_error"),
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized"),
            AppError::Forbidden => (StatusCode::FORBIDDEN, "forbidden"),
            AppError::Conflict(_) => (StatusCode::CONFLICT, "conflict"),
            AppError::RateLimited => (StatusCode::TOO_MANY_REQUESTS, "rate_limited"),
            AppError::QuotaExceeded { .. } => (StatusCode::TOO_MANY_REQUESTS, "quota_exceeded"),
            AppError::Internal(_) | AppError::Database(_) => {
                tracing::error!(error = ?self, "Internal server error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error")
            }
        };

        let body = ErrorResponse {
            error: error_type.to_string(),
            message: self.to_string(),
        };

        (status, Json(body)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;

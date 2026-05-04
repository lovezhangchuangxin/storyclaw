use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::auth::handlers::AppState;
use crate::auth::middleware::{AdminUser, AuthUser};
use crate::error::{AppError, Result};
use crate::models::BackendModel;

use crate::crypto;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateModelRequest {
    pub name: String,
    pub provider: String,
    pub api_base: String,
    pub api_key: String,
    pub model: String,
    pub max_output_tokens: Option<i32>,
    pub context_window_tokens: Option<i32>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateModelRequest {
    pub name: Option<String>,
    pub provider: Option<String>,
    pub api_base: Option<String>,
    pub api_key: Option<String>,
    pub model: Option<String>,
    pub max_output_tokens: Option<i32>,
    pub context_window_tokens: Option<i32>,
    pub is_public: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendModelResponse {
    pub id: Uuid,
    pub name: String,
    pub provider: String,
    pub model: String,
    pub max_output_tokens: i32,
    pub context_window_tokens: i32,
    pub is_public: bool,
    pub can_edit: bool,
}

fn model_to_response(model: &BackendModel, is_admin: bool) -> BackendModelResponse {
    BackendModelResponse {
        id: model.id,
        name: model.name.clone(),
        provider: model.provider.clone(),
        model: model.model.clone(),
        max_output_tokens: model.max_output_tokens,
        context_window_tokens: model.context_window_tokens,
        is_public: model.is_public,
        can_edit: is_admin,
    }
}

pub async fn list_models(
    State(state): State<AppState>,
    auth_user: AuthUser,
) -> Result<Json<Vec<BackendModelResponse>>> {
    let is_admin = auth_user.role == "admin";
    let models = if is_admin {
        sqlx::query_as::<_, BackendModel>(
            "SELECT * FROM backend_models ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await?
    } else {
        sqlx::query_as::<_, BackendModel>(
            "SELECT * FROM backend_models WHERE is_public = TRUE ORDER BY created_at DESC",
        )
        .fetch_all(&state.pool)
        .await?
    };

    let result: Vec<_> = models
        .iter()
        .map(|m| model_to_response(m, is_admin))
        .collect();

    Ok(Json(result))
}

pub async fn get_model_by_id(pool: &sqlx::PgPool, id: Uuid) -> Result<BackendModel> {
    sqlx::query_as::<_, BackendModel>("SELECT * FROM backend_models WHERE id = $1")
        .bind(id)
        .fetch_optional(pool)
        .await?
        .ok_or(AppError::NotFound)
}

pub async fn create_model(
    State(state): State<AppState>,
    admin: AdminUser,
    Json(req): Json<CreateModelRequest>,
) -> Result<Json<BackendModelResponse>> {
    let encrypted = crypto::encrypt(&req.api_key, &state.config.model_key)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let model = sqlx::query_as::<_, BackendModel>(
        "INSERT INTO backend_models (name, provider, api_base, api_key_encrypted, model, \
         max_output_tokens, context_window_tokens, is_public, created_by) \
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *",
    )
    .bind(&req.name)
    .bind(&req.provider)
    .bind(&req.api_base)
    .bind(&encrypted)
    .bind(&req.model)
    .bind(req.max_output_tokens.unwrap_or(4096))
    .bind(req.context_window_tokens.unwrap_or(128000))
    .bind(req.is_public.unwrap_or(false))
    .bind(admin.0.user_id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(model_to_response(&model, true)))
}

pub async fn update_model(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateModelRequest>,
) -> Result<Json<BackendModelResponse>> {
    let existing = get_model_by_id(&state.pool, id).await?;

    let name = req.name.unwrap_or(existing.name);
    let provider = req.provider.unwrap_or(existing.provider);
    let api_base = req.api_base.unwrap_or(existing.api_base);
    let model_name = req.model.unwrap_or(existing.model);
    let max_output_tokens = req.max_output_tokens.unwrap_or(existing.max_output_tokens);
    let context_window_tokens = req.context_window_tokens.unwrap_or(existing.context_window_tokens);
    let is_public = req.is_public.unwrap_or(existing.is_public);

    let encrypted = if let Some(key) = req.api_key {
        crypto::encrypt(&key, &state.config.model_key)
            .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?
    } else {
        existing.api_key_encrypted
    };

    let updated = sqlx::query_as::<_, BackendModel>(
        "UPDATE backend_models SET name=$1, provider=$2, api_base=$3, api_key_encrypted=$4, \
         model=$5, max_output_tokens=$6, context_window_tokens=$7, is_public=$8, updated_at=NOW() \
         WHERE id=$9 RETURNING *",
    )
    .bind(&name)
    .bind(&provider)
    .bind(&api_base)
    .bind(&encrypted)
    .bind(&model_name)
    .bind(max_output_tokens)
    .bind(context_window_tokens)
    .bind(is_public)
    .bind(id)
    .fetch_one(&state.pool)
    .await?;

    Ok(Json(model_to_response(&updated, true)))
}

pub async fn delete_model(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(id): Path<Uuid>,
) -> Result<axum::http::StatusCode> {
    let result = sqlx::query("DELETE FROM backend_models WHERE id = $1")
        .bind(id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }
    Ok(axum::http::StatusCode::NO_CONTENT)
}

pub fn models_routes(state: AppState) -> axum::Router {
    use axum::routing::{delete, get, post, put};
    axum::Router::new()
        .route("/", get(list_models))
        .route("/", post(create_model))
        .route("/{id}", put(update_model))
        .route("/{id}", delete(delete_model))
        .with_state(state)
}

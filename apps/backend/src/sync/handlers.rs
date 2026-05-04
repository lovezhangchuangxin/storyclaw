use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::handlers::AppState;
use crate::auth::middleware::AuthUser;
use crate::error::{AppError, Result};
use crate::models::Novel;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct NovelSummary {
    pub id: Uuid,
    pub title: String,
    pub word_count: i64,
    pub status: String,
    pub version: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ListResponse {
    pub novels: Vec<NovelSummary>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

#[derive(Debug, Deserialize)]
pub struct PushRequest {
    pub data: serde_json::Value,
    pub version: i32,
}

#[derive(Debug, Serialize)]
pub struct PushResponse {
    pub accepted: bool,
    pub server_version: i32,
    pub backend_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct PullResponse {
    pub data: serde_json::Value,
    pub version: i32,
}

pub async fn list_novels(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM novels WHERE user_id = $1",
    )
    .bind(auth_user.user_id)
    .fetch_one(&state.pool)
    .await?;

    let rows = sqlx::query(
        "SELECT id, data->>'title', CAST(data->>'currentWordCount' AS BIGINT), \
         data->>'status', version, \
         to_char(created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), \
         to_char(updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') \
         FROM novels WHERE user_id = $1 \
         ORDER BY updated_at DESC LIMIT $2 OFFSET $3",
    )
    .bind(auth_user.user_id)
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    let novels: Vec<NovelSummary> = rows
        .iter()
        .map(|r| NovelSummary {
            id: r.get(0),
            title: r.get::<Option<String>, _>(1).unwrap_or_default(),
            word_count: r.get::<Option<i64>, _>(2).unwrap_or(0),
            status: r.get::<Option<String>, _>(3).unwrap_or_else(|| "drafting".into()),
            version: r.get(4),
            created_at: r.get(5),
            updated_at: r.get(6),
        })
        .collect();

    Ok(Json(ListResponse {
        novels,
        total,
        page,
        per_page,
    }))
}

pub async fn push_novel(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(novel_id): Path<Uuid>,
    Json(req): Json<PushRequest>,
) -> Result<Json<PushResponse>> {
    let result = sqlx::query(
        "INSERT INTO novels (id, user_id, data, version) \
         VALUES ($1, $2, $3, $4) \
         ON CONFLICT (id) DO UPDATE \
         SET data = EXCLUDED.data, version = EXCLUDED.version, updated_at = NOW() \
         WHERE novels.version < $4 AND novels.user_id = $2",
    )
    .bind(novel_id)
    .bind(auth_user.user_id)
    .bind(&req.data)
    .bind(req.version)
    .execute(&state.pool)
    .await?;

    if result.rows_affected() > 0 {
        Ok(Json(PushResponse {
            accepted: true,
            server_version: req.version,
            backend_id: Some(novel_id),
        }))
    } else {
        let server_version = sqlx::query_scalar::<_, i32>(
            "SELECT version FROM novels WHERE id = $1 AND user_id = $2",
        )
        .bind(novel_id)
        .bind(auth_user.user_id)
        .fetch_optional(&state.pool)
        .await?;

        Ok(Json(PushResponse {
            accepted: false,
            server_version: server_version.unwrap_or(0),
            backend_id: None,
        }))
    }
}

pub async fn pull_novel(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(novel_id): Path<Uuid>,
) -> Result<Json<PullResponse>> {
    let novel = sqlx::query_as::<_, Novel>(
        "SELECT * FROM novels WHERE id = $1 AND user_id = $2",
    )
    .bind(novel_id)
    .bind(auth_user.user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(AppError::NotFound)?;

    Ok(Json(PullResponse {
        data: novel.data,
        version: novel.version,
    }))
}

pub async fn delete_novel(
    State(state): State<AppState>,
    auth_user: AuthUser,
    Path(novel_id): Path<Uuid>,
) -> Result<axum::http::StatusCode> {
    let result = sqlx::query("DELETE FROM novels WHERE id = $1 AND user_id = $2")
        .bind(novel_id)
        .bind(auth_user.user_id)
        .execute(&state.pool)
        .await?;

    if result.rows_affected() == 0 {
        return Err(AppError::NotFound);
    }

    Ok(axum::http::StatusCode::NO_CONTENT)
}

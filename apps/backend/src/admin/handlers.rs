use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::auth::handlers::AppState;
use crate::auth::middleware::AdminUser;
use crate::error::Result;

#[derive(Debug, Deserialize)]
pub struct ListQuery {
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct AdminUserSummary {
    pub id: Uuid,
    pub email: String,
    pub role: String,
    pub novel_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct AdminNovelSummary {
    pub id: Uuid,
    pub title: String,
    pub author_email: String,
    pub word_count: i64,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct AdminStats {
    pub total_users: i64,
    pub total_novels: i64,
    pub total_llm_calls: i64,
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub data: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub per_page: i64,
}

pub async fn list_users(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<PaginatedResponse<AdminUserSummary>>> {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.pool)
        .await?;

    let rows = sqlx::query(
        "SELECT u.id, u.email, u.role, \
         COALESCE(n.cnt, 0) as novel_count, \
         to_char(u.created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), \
         to_char(u.updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') \
         FROM users u \
         LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM novels GROUP BY user_id) n ON u.id = n.user_id \
         ORDER BY u.created_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    let users: Vec<AdminUserSummary> = rows.iter().map(|r| AdminUserSummary {
        id: r.get(0),
        email: r.get(1),
        role: r.get(2),
        novel_count: r.get(3),
        created_at: r.get(4),
        updated_at: r.get(5),
    }).collect();

    Ok(Json(PaginatedResponse { data: users, total, page, per_page }))
}

pub async fn get_user(
    State(state): State<AppState>,
    _admin: AdminUser,
    Path(user_id): Path<Uuid>,
) -> Result<Json<AdminUserSummary>> {
    let row = sqlx::query(
        "SELECT u.id, u.email, u.role, \
         COALESCE(n.cnt, 0) as novel_count, \
         to_char(u.created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), \
         to_char(u.updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') \
         FROM users u \
         LEFT JOIN (SELECT user_id, COUNT(*) as cnt FROM novels GROUP BY user_id) n ON u.id = n.user_id \
         WHERE u.id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.pool)
    .await?
    .ok_or(crate::error::AppError::NotFound)?;

    Ok(Json(AdminUserSummary {
        id: row.get(0),
        email: row.get(1),
        role: row.get(2),
        novel_count: row.get(3),
        created_at: row.get(4),
        updated_at: row.get(5),
    }))
}

pub async fn list_novels(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<ListQuery>,
) -> Result<Json<PaginatedResponse<AdminNovelSummary>>> {
    let page = query.page.unwrap_or(1).max(1);
    let per_page = query.per_page.unwrap_or(20).min(100);
    let offset = (page - 1) * per_page;

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM novels")
        .fetch_one(&state.pool)
        .await?;

    let rows = sqlx::query(
        "SELECT n.id, n.data->>'title', u.email, \
         CAST(n.data->>'currentWordCount' AS BIGINT), n.data->>'status', \
         to_char(n.created_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"'), \
         to_char(n.updated_at, 'YYYY-MM-DD\"T\"HH24:MI:SS\"Z\"') \
         FROM novels n JOIN users u ON n.user_id = u.id \
         ORDER BY n.updated_at DESC LIMIT $1 OFFSET $2",
    )
    .bind(per_page)
    .bind(offset)
    .fetch_all(&state.pool)
    .await?;

    let novels: Vec<AdminNovelSummary> = rows.iter().map(|r| AdminNovelSummary {
        id: r.get(0),
        title: r.get::<Option<String>, _>(1).unwrap_or_default(),
        author_email: r.get(2),
        word_count: r.get::<Option<i64>, _>(3).unwrap_or(0),
        status: r.get::<Option<String>, _>(4).unwrap_or_else(|| "drafting".into()),
        created_at: r.get(5),
        updated_at: r.get(6),
    }).collect();

    Ok(Json(PaginatedResponse { data: novels, total, page, per_page }))
}

pub async fn get_stats(
    State(state): State<AppState>,
    _admin: AdminUser,
) -> Result<Json<AdminStats>> {
    let total_users: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM users")
        .fetch_one(&state.pool)
        .await?;

    let total_novels: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM novels")
        .fetch_one(&state.pool)
        .await?;

    let total_llm_calls: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM llm_logs")
        .fetch_one(&state.pool)
        .await?;

    Ok(Json(AdminStats { total_users, total_novels, total_llm_calls }))
}

#[derive(Debug, Deserialize)]
pub struct UsageQuery {
    pub days: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct UserUsageEntry {
    pub user_id: Uuid,
    pub email: String,
    pub total_requests: i64,
    pub total_tokens: i64,
    pub prompt_tokens: i64,
    pub completion_tokens: i64,
}

pub async fn get_usage_stats(
    State(state): State<AppState>,
    _admin: AdminUser,
    Query(query): Query<UsageQuery>,
) -> Result<Json<Vec<UserUsageEntry>>> {
    let days = query.days.unwrap_or(30).clamp(1, 365);

    let rows = sqlx::query(
        "SELECT l.user_id, u.email, \
         COUNT(*) as total_requests, \
         COALESCE(SUM(l.total_tokens), 0) as total_tokens, \
         COALESCE(SUM(l.prompt_tokens), 0) as prompt_tokens, \
         COALESCE(SUM(l.completion_tokens), 0) as completion_tokens \
         FROM llm_logs l JOIN users u ON l.user_id = u.id \
         WHERE l.created_at >= NOW() - make_interval(days => $1) \
         GROUP BY l.user_id, u.email \
         ORDER BY total_tokens DESC",
    )
    .bind(days)
    .fetch_all(&state.pool)
    .await?;

    let entries: Vec<UserUsageEntry> = rows
        .iter()
        .map(|r| UserUsageEntry {
            user_id: r.get(0),
            email: r.get(1),
            total_requests: r.get(2),
            total_tokens: r.get(3),
            prompt_tokens: r.get(4),
            completion_tokens: r.get(5),
        })
        .collect();

    Ok(Json(entries))
}

use sqlx::PgPool;
use uuid::Uuid;

pub struct AuditEntry {
    pub user_id: Uuid,
    pub backend_model_id: Uuid,
    pub model_name: String,
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
    pub is_stream: bool,
}

pub fn spawn_audit_log(pool: PgPool, entry: AuditEntry) {
    tokio::spawn(async move {
        let result = sqlx::query(
            "INSERT INTO llm_logs (user_id, model, prompt_tokens, completion_tokens, \
             total_tokens, is_stream, backend_model_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind(entry.user_id)
        .bind(&entry.model_name)
        .bind(entry.prompt_tokens)
        .bind(entry.completion_tokens)
        .bind(entry.total_tokens)
        .bind(entry.is_stream)
        .bind(entry.backend_model_id)
        .execute(&pool)
        .await;

        if let Err(e) = result {
            tracing::error!("Failed to write audit log: {}", e);
        }
    });
}

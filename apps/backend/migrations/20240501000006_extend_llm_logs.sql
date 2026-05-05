-- Extend llm_logs for richer audit logging
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS backend_model_id UUID;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS total_tokens INT NOT NULL DEFAULT 0;
ALTER TABLE llm_logs ADD COLUMN IF NOT EXISTS is_stream BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for admin dashboard: per-user daily usage queries
CREATE INDEX IF NOT EXISTS idx_llm_logs_user_created ON llm_logs(user_id, created_at DESC);

CREATE TABLE backend_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    api_base VARCHAR(500) NOT NULL,
    api_key_encrypted BYTEA NOT NULL,
    model VARCHAR(100) NOT NULL,
    max_output_tokens INT NOT NULL DEFAULT 4096,
    context_window_tokens INT NOT NULL DEFAULT 128000,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_backend_models_public ON backend_models(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_backend_models_created_by ON backend_models(created_by);

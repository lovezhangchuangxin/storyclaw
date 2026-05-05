CREATE TABLE device_fingerprints (
    fingerprint VARCHAR(64) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (fingerprint, user_id)
);

CREATE INDEX idx_device_fingerprints_fingerprint ON device_fingerprints (fingerprint);
CREATE INDEX idx_device_fingerprints_created_at ON device_fingerprints (created_at);

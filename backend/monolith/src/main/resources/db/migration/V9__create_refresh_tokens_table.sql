-- V9: Refresh tokens for stateless JWT rotation
CREATE TABLE IF NOT EXISTS users.refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID        NOT NULL REFERENCES users.users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64) NOT NULL UNIQUE,   -- SHA-256 hex of the raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    used        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_token_hash ON users.refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_user_id    ON users.refresh_tokens (user_id);

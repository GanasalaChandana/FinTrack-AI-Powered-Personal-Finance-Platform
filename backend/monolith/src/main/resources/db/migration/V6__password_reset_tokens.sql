-- V6: "forgot password". A reset link carries a random token; only its SHA-256
-- hash is stored. Tokens expire after 30 minutes and work once.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID         PRIMARY KEY,
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(64)  NOT NULL UNIQUE,
    expires_at  TIMESTAMP(6) NOT NULL,
    used        BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens (user_id);

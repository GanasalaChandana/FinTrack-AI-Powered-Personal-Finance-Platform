-- V8: bank connections through Plaid.
-- A connected bank ("item"). The access token is stored encrypted (AES-GCM).
CREATE TABLE IF NOT EXISTS plaid_items (
    id               UUID          PRIMARY KEY,
    user_id          VARCHAR(255)  NOT NULL,
    item_id          VARCHAR(255)  NOT NULL UNIQUE,
    access_token_enc VARCHAR(1024) NOT NULL,
    institution_name VARCHAR(255),
    sync_cursor      TEXT,
    status           VARCHAR(30)   NOT NULL,      -- OK, LOGIN_REQUIRED, ERROR
    last_error       VARCHAR(500),
    last_synced_at   TIMESTAMP(6),
    created_at       TIMESTAMP(6)  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plaid_items_user ON plaid_items (user_id);

-- Imported transactions remember where they came from ("plaid:<transaction_id>"),
-- so a sync never adds the same one twice and can apply updates and removals.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id VARCHAR(255);
-- (NULLs never clash in a unique index, so hand-entered transactions are unaffected)
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_user_external
    ON transactions (user_id, external_id);

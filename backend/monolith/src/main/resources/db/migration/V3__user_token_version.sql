-- V3: per-user token version. Every access token carries the version it was issued
-- with; signing out, changing the password or deleting the account bumps it, so all
-- older tokens stop working at once instead of staying valid until they expire.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

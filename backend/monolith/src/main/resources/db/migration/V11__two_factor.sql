-- Two-factor sign-in with an authenticator app
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255);          -- AES-GCM encrypted
ALTER TABLE users ADD COLUMN totp_last_step BIGINT;             -- last code's time step (no reuse)
ALTER TABLE users ADD COLUMN totp_backup_codes VARCHAR(1000);   -- SHA-256 hashes, comma-separated

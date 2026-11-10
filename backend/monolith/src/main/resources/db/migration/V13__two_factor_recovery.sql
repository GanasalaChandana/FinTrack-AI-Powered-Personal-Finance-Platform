-- Recovering an account whose authenticator and backup codes are lost:
-- two-factor turns off at totp_recovery_at unless the owner cancels
ALTER TABLE users ADD COLUMN totp_recovery_at TIMESTAMP;
ALTER TABLE users ADD COLUMN totp_recovery_cancel_hash VARCHAR(64);

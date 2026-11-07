-- V7: the notification choices from Settings → Notifications, stored on the server
-- (they used to live only in the browser, where the backend couldn't respect them).
-- budget_alerts_enabled and transaction_alerts_enabled (large transactions) exist already.
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS weekly_digest               BOOLEAN       NOT NULL DEFAULT FALSE;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS goal_milestones             BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS monthly_report              BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS unusual_spending            BOOLEAN       NOT NULL DEFAULT TRUE;
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS large_transaction_threshold NUMERIC(12, 2) NOT NULL DEFAULT 500;

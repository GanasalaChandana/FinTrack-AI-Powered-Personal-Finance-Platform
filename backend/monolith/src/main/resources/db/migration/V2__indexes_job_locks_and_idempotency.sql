-- V2: query indexes, a lock table for scheduled jobs, and keys that stop jobs
-- creating duplicates. Written with IF NOT EXISTS so it is safe on the existing
-- production database (built by Hibernate) as well as on a fresh one.

-- ── 1. Indexes for the hot queries (every list / report filters by user) ─────
CREATE INDEX IF NOT EXISTS idx_transactions_user_date     ON transactions (user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions (user_id, category);
CREATE INDEX IF NOT EXISTS idx_recurring_user             ON recurring_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_due              ON recurring_transactions (active, next_occurrence);
CREATE INDEX IF NOT EXISTS idx_budgets_user_month         ON budgets (user_id, month);
CREATE INDEX IF NOT EXISTS idx_budgets_month              ON budgets (month);
CREATE INDEX IF NOT EXISTS idx_goals_user                 ON goals (user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_user_read           ON alerts (user_id, read);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user        ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_user_created ON alert_history (user_id, created_at);

-- ── 2. ShedLock: only one app instance runs each scheduled job at a time ────
CREATE TABLE IF NOT EXISTS shedlock (
    name       VARCHAR(64)  NOT NULL PRIMARY KEY,
    lock_until TIMESTAMP(3) NOT NULL,
    locked_at  TIMESTAMP(3) NOT NULL,
    locked_by  VARCHAR(255) NOT NULL
);

-- ── 3. Idempotency keys ─────────────────────────────────────────────────────
-- A recurring rule creates at most one transaction per occurrence date.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurring_id BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_recurring_occurrence
    ON transactions (recurring_id, date);

-- A budget alert of a given type fires at most once per user, category and month.
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_dedupe_key ON alerts (dedupe_key);

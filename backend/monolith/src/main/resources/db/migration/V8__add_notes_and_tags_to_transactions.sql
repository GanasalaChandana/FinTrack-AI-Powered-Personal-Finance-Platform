-- V8: Add notes and tags to transactions table
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS notes VARCHAR(1000),
    ADD COLUMN IF NOT EXISTS tags  VARCHAR(500);

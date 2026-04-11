-- Add status column to transactions table
ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'completed';

-- Back-fill existing rows
UPDATE transactions SET status = 'completed' WHERE status IS NULL;

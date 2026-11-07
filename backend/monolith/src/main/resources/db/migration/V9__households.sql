-- V9: households. Members share household budgets; each person's transactions stay
-- private (members see a shared budget's total, which counts everyone's spending).
CREATE TABLE IF NOT EXISTS households (
    id          UUID          PRIMARY KEY,
    name        VARCHAR(100)  NOT NULL,
    owner_id    VARCHAR(255)  NOT NULL,
    created_at  TIMESTAMP(6)  NOT NULL
);

-- A person belongs to at most one household.
CREATE TABLE IF NOT EXISTS household_members (
    user_id      VARCHAR(255) PRIMARY KEY,
    household_id UUID         NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    role         VARCHAR(20)  NOT NULL,          -- OWNER or MEMBER
    joined_at    TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_household_members_household ON household_members (household_id);

-- Email invitations; only the SHA-256 hash of the link's token is stored.
CREATE TABLE IF NOT EXISTS household_invites (
    id           UUID         PRIMARY KEY,
    household_id UUID         NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    email        VARCHAR(255) NOT NULL,
    token_hash   VARCHAR(64)  NOT NULL UNIQUE,
    invited_by   VARCHAR(255) NOT NULL,
    expires_at   TIMESTAMP(6) NOT NULL,
    accepted     BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_household_invites_household ON household_invites (household_id);

-- A budget shared with the household (NULL = personal).
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS household_id UUID;
CREATE INDEX IF NOT EXISTS idx_budgets_household ON budgets (household_id);

-- V17: investments and account balances, so net worth can update itself.

-- Accounts inside a connected bank (checking, credit card, loan, brokerage...) with their
-- latest balance, refreshed on every sync. Removed with the connection.
CREATE TABLE IF NOT EXISTS plaid_accounts (
    id               UUID          PRIMARY KEY,
    user_id          VARCHAR(255)  NOT NULL,
    plaid_item_id    UUID          NOT NULL REFERENCES plaid_items (id) ON DELETE CASCADE,
    account_id       VARCHAR(255)  NOT NULL,
    name             VARCHAR(255),
    mask             VARCHAR(10),
    type             VARCHAR(30),             -- depository, credit, loan, investment, other
    subtype          VARCHAR(50),
    current_balance  NUMERIC(15, 2),
    currency         VARCHAR(3),
    updated_at       TIMESTAMP(6)  NOT NULL,
    CONSTRAINT uq_plaid_accounts UNIQUE (plaid_item_id, account_id)
);
CREATE INDEX IF NOT EXISTS idx_plaid_accounts_user ON plaid_accounts (user_id);

-- Investment holdings: added by hand (priced from market quotes) or imported from a
-- connected brokerage (priced by the institution).
CREATE TABLE IF NOT EXISTS holdings (
    id               UUID          PRIMARY KEY,
    user_id          VARCHAR(255)  NOT NULL,
    symbol           VARCHAR(20),
    name             VARCHAR(255)  NOT NULL,
    asset_type       VARCHAR(20)   NOT NULL,  -- STOCK, ETF, FUND, CRYPTO, BOND, CASH, OTHER
    quantity         NUMERIC(24, 8) NOT NULL,
    cost_basis       NUMERIC(15, 2),          -- total paid
    last_price       NUMERIC(18, 6),
    price_updated_at TIMESTAMP(6),
    source           VARCHAR(10)   NOT NULL,  -- MANUAL or PLAID
    plaid_item_id    UUID          REFERENCES plaid_items (id) ON DELETE CASCADE,
    external_id      VARCHAR(255),            -- account + security, for re-imports
    account_name     VARCHAR(255),
    created_at       TIMESTAMP(6)  NOT NULL,
    updated_at       TIMESTAMP(6)  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON holdings (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_holdings_user_external ON holdings (user_id, external_id);

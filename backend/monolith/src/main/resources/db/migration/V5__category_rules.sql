-- V5: categories learned from the user. When someone changes a transaction's
-- category, the merchant -> category choice is remembered and used for that
-- merchant's future transactions and imports (before the keyword rules).
CREATE TABLE IF NOT EXISTS category_rules (
    id           BIGSERIAL    PRIMARY KEY,
    user_id      VARCHAR(255) NOT NULL,
    merchant_key VARCHAR(255) NOT NULL,   -- normalised merchant (see CategoryRuleService.key)
    category     VARCHAR(100) NOT NULL,
    updated_at   TIMESTAMP(6) NOT NULL,
    CONSTRAINT uq_category_rules_user_merchant UNIQUE (user_id, merchant_key)
);

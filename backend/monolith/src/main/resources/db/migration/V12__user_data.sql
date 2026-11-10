-- Small per-user app data that used to live only in the browser
-- (debts, net worth, custom categories, rollover history, insight check-offs, preferences)
CREATE TABLE user_data (
    user_id    VARCHAR(64)  NOT NULL,
    data_key   VARCHAR(100) NOT NULL,
    data_value TEXT         NOT NULL,
    updated_at TIMESTAMP    NOT NULL,
    PRIMARY KEY (user_id, data_key)
);

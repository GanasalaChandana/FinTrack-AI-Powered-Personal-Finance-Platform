-- Browser push subscriptions (one per device the user turned push on for)
CREATE TABLE push_subscriptions (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     VARCHAR(64)  NOT NULL,
    endpoint    VARCHAR(1000) NOT NULL UNIQUE,
    p256dh      VARCHAR(200) NOT NULL,
    auth        VARCHAR(100) NOT NULL,
    created_at  TIMESTAMP    NOT NULL
);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

-- Small app-wide settings, e.g. the server's push (VAPID) key pair
CREATE TABLE app_settings (
    setting_key   VARCHAR(100) PRIMARY KEY,
    setting_value TEXT         NOT NULL
);

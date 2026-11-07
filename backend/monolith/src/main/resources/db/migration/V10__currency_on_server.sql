-- The user's display currency, so emails and alerts can show amounts in it
ALTER TABLE notification_settings ADD COLUMN currency VARCHAR(3) NOT NULL DEFAULT 'USD';

-- Alerts created before amounts followed the user's currency hard-coded "$"
UPDATE alerts SET message = REPLACE(message, '$', ''), title = REPLACE(title, '$', '')
 WHERE message LIKE '%$%' OR title LIKE '%$%';

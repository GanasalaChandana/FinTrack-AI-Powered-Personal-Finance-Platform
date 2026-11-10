-- Which Plaid environment a connection belongs to: with a public sandbox demo next to real
-- (production) connections, each must keep using the environment it was made in.
-- Existing connections: '' = the server's configured environment, as before.
ALTER TABLE plaid_items ADD COLUMN environment VARCHAR(20) NOT NULL DEFAULT '';

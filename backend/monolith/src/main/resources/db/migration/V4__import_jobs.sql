-- V4: background CSV imports. The browser posts all rows at once and gets a job id
-- back; the rows are saved in the background and the browser polls this row for
-- progress. Kept in the database (not in memory) so any instance can report it.
CREATE TABLE IF NOT EXISTS import_jobs (
    id          UUID         PRIMARY KEY,
    user_id     VARCHAR(255) NOT NULL,
    status      VARCHAR(20)  NOT NULL,          -- PENDING, RUNNING, DONE, FAILED
    total       INTEGER      NOT NULL,
    processed   INTEGER      NOT NULL,
    imported    INTEGER      NOT NULL,
    failed      INTEGER      NOT NULL,
    error       VARCHAR(500),
    created_at  TIMESTAMP(6) NOT NULL,
    updated_at  TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user ON import_jobs (user_id);

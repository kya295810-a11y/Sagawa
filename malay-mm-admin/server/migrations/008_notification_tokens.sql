BEGIN;

CREATE TABLE IF NOT EXISTS notification_tokens (
  token text PRIMARY KEY,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE notification_tokens
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS notification_tokens_updated_at_idx
  ON notification_tokens (updated_at DESC);

COMMIT;

BEGIN;

CREATE TABLE IF NOT EXISTS user_password_resets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT user_password_resets_attempts_range CHECK (attempts BETWEEN 0 AND 5)
);

CREATE INDEX IF NOT EXISTS user_password_resets_user_created_idx
  ON user_password_resets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_password_resets_expiry_idx
  ON user_password_resets (expires_at);

COMMIT;

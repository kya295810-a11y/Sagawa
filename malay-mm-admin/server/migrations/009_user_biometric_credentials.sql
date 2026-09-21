BEGIN;

CREATE TABLE IF NOT EXISTS user_biometric_credentials (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE,
  platform text NOT NULL DEFAULT 'mobile',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS user_biometric_credentials_user_idx
  ON user_biometric_credentials (user_id);

COMMIT;

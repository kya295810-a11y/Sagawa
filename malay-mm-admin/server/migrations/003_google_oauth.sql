BEGIN;

ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email_at_link text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT user_identities_provider_allowed CHECK (provider IN ('google'))
);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_subject_unique
  ON user_identities (provider, provider_subject);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_user_provider_unique
  ON user_identities (user_id, provider);

CREATE TABLE IF NOT EXISTS user_oauth_handoffs (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash char(64) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_oauth_handoffs_expiry_idx
  ON user_oauth_handoffs (expires_at);

COMMIT;

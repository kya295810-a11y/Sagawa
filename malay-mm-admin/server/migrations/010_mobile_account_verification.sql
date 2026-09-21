BEGIN;

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS phone_number text,
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

DROP INDEX IF EXISTS users_email_lower_unique;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique
  ON users (lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_unique
  ON users (phone_number)
  WHERE phone_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'users_identifier_required' AND conrelid = 'users'::regclass
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_identifier_required
      CHECK (email IS NOT NULL OR phone_number IS NOT NULL);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_auth_challenges (
  id uuid PRIMARY KEY,
  purpose text NOT NULL CHECK (purpose IN ('signup', 'login')),
  channel text NOT NULL CHECK (channel IN ('email', 'phone')),
  identifier text NOT NULL,
  code_hash char(64) NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  expires_at timestamptz NOT NULL,
  resend_after timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_auth_challenges_lookup_idx
  ON user_auth_challenges (purpose, channel, identifier, created_at DESC);

CREATE INDEX IF NOT EXISTS user_auth_challenges_expiry_idx
  ON user_auth_challenges (expires_at);

COMMIT;

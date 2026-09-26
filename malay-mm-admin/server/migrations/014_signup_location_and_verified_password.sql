BEGIN;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS country_code char(2),
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS city text;

ALTER TABLE user_auth_challenges
  DROP CONSTRAINT IF EXISTS user_auth_challenges_purpose_check;

ALTER TABLE user_auth_challenges
  ADD CONSTRAINT user_auth_challenges_purpose_check
  CHECK (purpose IN ('signup', 'signup_verified', 'login'));

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_country_code_allowed'
      AND conrelid = 'profiles'::regclass
  ) THEN
    ALTER TABLE profiles
      ADD CONSTRAINT profiles_country_code_allowed
      CHECK (country_code IS NULL OR country_code IN ('MY', 'SG', 'TH'));
  END IF;
END $;

CREATE INDEX IF NOT EXISTS profiles_country_code_idx
  ON profiles (country_code)
  WHERE country_code IS NOT NULL;

COMMIT;

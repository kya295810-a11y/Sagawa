BEGIN;

-- Repair legacy notification_tokens tables that predate platform tracking.
-- New installs already receive this column from 008_notification_tokens.sql.
ALTER TABLE notification_tokens
  ADD COLUMN IF NOT EXISTS platform text;

-- Keep the accepted values aligned with the API validation while allowing
-- legacy rows with an unknown platform to survive the upgrade.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'notification_tokens_platform_check'
       AND conrelid = 'notification_tokens'::regclass
  ) THEN
    ALTER TABLE notification_tokens
      ADD CONSTRAINT notification_tokens_platform_check
      CHECK (platform IN ('android', 'ios')) NOT VALID;
  END IF;
END
$$;

-- If there are no legacy NULL rows, make the repaired schema match fresh installs.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM notification_tokens
     WHERE platform IS NULL
  ) THEN
    ALTER TABLE notification_tokens
      ALTER COLUMN platform SET NOT NULL;
  END IF;
END
$$;

COMMIT;

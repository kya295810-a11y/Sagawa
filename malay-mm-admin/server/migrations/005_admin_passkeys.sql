BEGIN;

CREATE TABLE IF NOT EXISTS passkeys (
  id text PRIMARY KEY,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports jsonb NOT NULL DEFAULT '[]'::jsonb
);

COMMIT;

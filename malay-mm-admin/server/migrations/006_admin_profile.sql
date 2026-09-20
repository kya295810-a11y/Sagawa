BEGIN;

CREATE TABLE IF NOT EXISTS admin_profile (
  id smallint PRIMARY KEY CHECK (id = 1),
  name text NOT NULL DEFAULT '',
  avatar_data bytea,
  avatar_mime text,
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

INSERT INTO admin_profile (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

COMMIT;

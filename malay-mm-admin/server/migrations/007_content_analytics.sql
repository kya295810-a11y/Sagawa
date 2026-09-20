BEGIN;

CREATE TABLE IF NOT EXISTS content_analytics (
  content_type text NOT NULL CHECK (content_type IN ('news', 'service')),
  content_id text NOT NULL,
  views bigint NOT NULL DEFAULT 0 CHECK (views >= 0),
  clicks bigint NOT NULL DEFAULT 0 CHECK (clicks >= 0),
  reach bigint NOT NULL DEFAULT 0 CHECK (reach >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_type, content_id)
);

CREATE TABLE IF NOT EXISTS content_reach (
  content_type text NOT NULL CHECK (content_type IN ('news', 'service')),
  content_id text NOT NULL,
  viewer_hash char(64) NOT NULL,
  first_seen_at timestamptz NOT NULL DEFAULT NOW(),
  last_seen_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (content_type, content_id, viewer_hash)
);

CREATE INDEX IF NOT EXISTS content_reach_content_idx
  ON content_reach (content_type, content_id);

COMMIT;

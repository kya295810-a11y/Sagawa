BEGIN;

CREATE TABLE IF NOT EXISTS exchange_provider_rates (
  id bigserial PRIMARY KEY,
  name varchar(80) NOT NULL,
  rate numeric(18, 6) NOT NULL CHECK (rate > 0),
  logo_url text NOT NULL DEFAULT '',
  website_url text NOT NULL DEFAULT '',
  published boolean NOT NULL DEFAULT TRUE,
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order >= 0),
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS exchange_provider_rates_display_idx
  ON exchange_provider_rates (published, display_order, id);

COMMIT;

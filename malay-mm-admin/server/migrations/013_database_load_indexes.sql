BEGIN;

-- Public content lists are read far more often than they are written.
CREATE INDEX IF NOT EXISTS news_public_created_idx
  ON news (created_at DESC)
  WHERE published = TRUE;

CREATE INDEX IF NOT EXISTS services_public_created_idx
  ON services (created_at DESC)
  WHERE published = TRUE;

-- Exchange history can grow continuously; keep the latest-rate lookup cheap.
CREATE INDEX IF NOT EXISTS exchange_rates_latest_idx
  ON exchange_rates (updated_at DESC, id DESC);

-- Keep the admin analytics ordering efficient as event volume grows.
CREATE INDEX IF NOT EXISTS content_analytics_rank_idx
  ON content_analytics (views DESC, clicks DESC, updated_at DESC);

COMMIT;

BEGIN;

-- Some integration-test schemas intentionally contain only account tables.
-- Production content tables receive these indexes when they exist.
DO $$
BEGIN
  IF to_regclass('news') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS news_public_created_idx
      ON news (created_at DESC)
      WHERE published = TRUE;
  END IF;

  IF to_regclass('services') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS services_public_created_idx
      ON services (created_at DESC)
      WHERE published = TRUE;
  END IF;

  IF to_regclass('exchange_rates') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS exchange_rates_latest_idx
      ON exchange_rates (updated_at DESC, id DESC);
  END IF;

  IF to_regclass('content_analytics') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS content_analytics_rank_idx
      ON content_analytics (views DESC, clicks DESC, updated_at DESC);
  END IF;
END $$;

COMMIT;

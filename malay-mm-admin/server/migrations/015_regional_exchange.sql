BEGIN;

DO $$
BEGIN
  IF to_regclass('exchange_rates') IS NOT NULL THEN
    ALTER TABLE exchange_rates
      ADD COLUMN IF NOT EXISTS country_code varchar(2) NOT NULL DEFAULT 'MY',
      ADD COLUMN IF NOT EXISTS base_currency varchar(3) NOT NULL DEFAULT 'MYR';

    UPDATE exchange_rates
    SET country_code = 'MY',
        base_currency = 'MYR'
    WHERE country_code IS NULL
       OR base_currency IS NULL;

    CREATE INDEX IF NOT EXISTS exchange_rates_country_latest_idx
      ON exchange_rates (country_code, updated_at DESC, id DESC);
  END IF;

  IF to_regclass('exchange_provider_rates') IS NOT NULL THEN
    ALTER TABLE exchange_provider_rates
      ADD COLUMN IF NOT EXISTS country_code varchar(2) NOT NULL DEFAULT 'MY',
      ADD COLUMN IF NOT EXISTS base_currency varchar(3) NOT NULL DEFAULT 'MYR';

    UPDATE exchange_provider_rates
    SET country_code = 'MY',
        base_currency = 'MYR'
    WHERE country_code IS NULL
       OR base_currency IS NULL;

    CREATE INDEX IF NOT EXISTS exchange_provider_rates_country_display_idx
      ON exchange_provider_rates (country_code, published, display_order, id);
  END IF;
END
$$;

COMMIT;

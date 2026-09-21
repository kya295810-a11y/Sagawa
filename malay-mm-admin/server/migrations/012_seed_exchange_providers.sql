BEGIN;

INSERT INTO exchange_provider_rates
  (name, rate, logo_url, website_url, published, display_order, updated_at)
SELECT
  'Merchantrade',
  1076.50,
  '',
  'https://www.merchantrademoney.com/',
  TRUE,
  0,
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM exchange_provider_rates
  WHERE LOWER(name) = LOWER('Merchantrade')
);

INSERT INTO exchange_provider_rates
  (name, rate, logo_url, website_url, published, display_order, updated_at)
SELECT
  'Western Union',
  1073.00,
  '',
  'https://www.westernunion.com/my/en/home.html',
  TRUE,
  1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM exchange_provider_rates
  WHERE LOWER(name) = LOWER('Western Union')
);

COMMIT;

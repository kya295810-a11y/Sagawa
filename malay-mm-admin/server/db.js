const { Pool } = require('pg');

const sslEnabled = /^(1|true|yes)$/i.test(String(process.env.DB_SSL || ''));
const ssl = sslEnabled
  ? {
      rejectUnauthorized: !/^(0|false|no)$/i.test(String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '')),
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
    }
  : undefined;

function positiveNumber(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

const pool = new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }),
  ...(ssl ? { ssl } : {}),
  // Keep the API from opening an unbounded number of PostgreSQL sessions.
  // Increase this only after checking the database connection limit.
  max: positiveNumber(process.env.DB_POOL_MAX, 10, { min: 2, max: 30 }),
  idleTimeoutMillis: positiveNumber(process.env.DB_IDLE_TIMEOUT_MS, 30000, { min: 1000 }),
  connectionTimeoutMillis: positiveNumber(process.env.DB_CONNECTION_TIMEOUT_MS, 5000, { min: 1000 }),
  statement_timeout: positiveNumber(process.env.DB_STATEMENT_TIMEOUT_MS, 8000, { min: 1000 }),
  query_timeout: positiveNumber(process.env.DB_QUERY_TIMEOUT_MS, 10000, { min: 1000 }),
  keepAlive: true,
  keepAliveInitialDelayMillis: positiveNumber(process.env.DB_KEEPALIVE_DELAY_MS, 10000, { min: 1000 }),
  maxUses: Number(process.env.DB_POOL_MAX_USES || 0) || undefined,
  application_name: process.env.DB_APPLICATION_NAME || 'sagawa-api',
});

pool.on('error', (error) => {
  // An idle client can fail independently of a request. Logging here prevents
  // an unhandled pool error from taking down the whole API process.
  console.error('[Database] Unexpected idle client error:', error.message);
});

module.exports = pool;

const { Pool } = require('pg');

const sslEnabled = /^(1|true|yes)$/i.test(String(process.env.DB_SSL || ''));
const ssl = sslEnabled
  ? {
      rejectUnauthorized: !/^(0|false|no)$/i.test(String(process.env.DB_SSL_REJECT_UNAUTHORIZED || '')),
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {}),
    }
  : undefined;

const pool = new Pool({
  ...(process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  }),
  ...(ssl ? { ssl } : {}),
  max: Number(process.env.DB_POOL_MAX || 10),
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 30000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  maxUses: Number(process.env.DB_POOL_MAX_USES || 0) || undefined,
});

module.exports = pool;

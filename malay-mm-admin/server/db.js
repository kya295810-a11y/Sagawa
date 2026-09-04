const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sagawa',
  user: process.env.DB_USER || 'kyawsanlin',
  password: process.env.DB_PASSWORD || '',
});

module.exports = pool;
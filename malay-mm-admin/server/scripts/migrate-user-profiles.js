const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const db = require('../db');

async function migrate() {
  const sql = fs.readFileSync(
    path.join(__dirname, '..', 'migrations', '001_user_profiles.sql'),
    'utf8',
  );
  try {
    await db.query(sql);
    console.log('User/profile migration applied successfully.');
  } catch (error) {
    console.error('User/profile migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

migrate();

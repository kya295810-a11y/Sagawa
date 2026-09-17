const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const db = require('../db');

async function migrate() {
  const migrationsDirectory = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => /^\d+_[a-z0-9_-]+\.sql$/i.test(file))
    .sort();

  try {
    for (const file of migrationFiles) {
      const sql = fs.readFileSync(path.join(migrationsDirectory, file), 'utf8');
      await db.query(sql);
      console.log(`[Database] Applied ${file}.`);
    }
  } catch (error) {
    console.error('[Database] Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

migrate();

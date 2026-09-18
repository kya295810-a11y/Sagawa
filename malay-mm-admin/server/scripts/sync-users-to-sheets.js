const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env'), quiet: true });

const db = require('../db');
const { syncAllUsersToSheet } = require('../google-sheets-sync');

async function main() {
  try {
    const result = await syncAllUsersToSheet({ platform: 'Mobile' });
    console.log(`[SheetsSync] Backfill complete. Synced ${result.synced} user(s).`);
  } catch (error) {
    console.error('[SheetsSync] Backfill failed:', error.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

main();

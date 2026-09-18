const test = require('node:test');
const assert = require('node:assert/strict');

const sheetsSync = require('../google-sheets-sync');

test('Google Sheets sync is disabled safely by default', () => {
  const previous = process.env.GOOGLE_SHEETS_SYNC_ENABLED;
  delete process.env.GOOGLE_SHEETS_SYNC_ENABLED;
  try {
    assert.deepEqual(sheetsSync.getConfig(), { enabled: false });
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_SHEETS_SYNC_ENABLED;
    else process.env.GOOGLE_SHEETS_SYNC_ENABLED = previous;
  }
});

test('enabled sync rejects incomplete credentials before network access', () => {
  const keys = [
    'GOOGLE_SHEETS_SYNC_ENABLED',
    'GOOGLE_SHEETS_SPREADSHEET_ID',
    'GOOGLE_SHEETS_CLIENT_EMAIL',
    'GOOGLE_SHEETS_PRIVATE_KEY',
  ];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  process.env.GOOGLE_SHEETS_SYNC_ENABLED = 'true';
  delete process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  delete process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
  delete process.env.GOOGLE_SHEETS_PRIVATE_KEY;

  try {
    assert.throws(() => sheetsSync.getConfig(), /SPREADSHEET_ID/);
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test('sheet titles are escaped safely for A1 notation', () => {
  assert.equal(sheetsSync.__test.quoteSheetTitle("Users"), "'Users'");
  assert.equal(sheetsSync.__test.quoteSheetTitle("O'Reilly"), "'O''Reilly'");
});

test('platform values are bounded and have a safe fallback', () => {
  assert.equal(sheetsSync.__test.normalizePlatform('android'), 'android');
  assert.equal(sheetsSync.__test.normalizePlatform(''), 'Mobile');
  assert.equal(sheetsSync.__test.normalizePlatform('x'.repeat(100)).length, 40);
});

test('snapshot rows match the Sagawa User Details column order', () => {
  const snapshot = {
    userId: 'user-1',
    name: 'Example User',
    email: 'user@example.com',
    phone: '+60123456789',
    loginMethod: 'Google',
    platform: 'android',
    registeredAt: '2026-09-18T10:00:00.000Z',
    lastLogin: '2026-09-18T11:00:00.000Z',
    status: 'Active',
    role: 'User',
  };

  assert.deepEqual(sheetsSync.__test.snapshotToRow(snapshot), [
    'user-1',
    'Example User',
    'user@example.com',
    '+60123456789',
    'Google',
    'android',
    '2026-09-18T10:00:00.000Z',
    '2026-09-18T11:00:00.000Z',
    'Active',
    'User',
  ]);
});

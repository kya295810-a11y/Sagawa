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

test('platform values match the Sheet dropdown options', () => {
  assert.equal(sheetsSync.__test.normalizePlatform('android'), 'Android');
  assert.equal(sheetsSync.__test.normalizePlatform('ios'), 'iOS');
  assert.equal(sheetsSync.__test.normalizePlatform('ANDROID'), 'Android');
  assert.equal(sheetsSync.__test.normalizePlatform(''), '');
  assert.equal(sheetsSync.__test.normalizePlatform('unknown'), '');
});

test('existing rows update only backend-managed A:I columns', () => {
  const snapshot = {
    userId: 'user-1',
    name: 'Example User',
    email: 'user@example.com',
    age: '22',
    gender: 'Male',
    loginMethod: 'Google',
    platform: 'Android',
    registeredAt: '2026-09-18T10:00:00.000Z',
    lastLogin: '2026-09-18T11:00:00.000Z',
  };

  assert.deepEqual(sheetsSync.__test.snapshotToManagedRow(snapshot), [
    'user-1',
    'Example User',
    'user@example.com',
    '22',
    'Male',
    'Google',
    'Android',
    '2026-09-18T10:00:00.000Z',
    '2026-09-18T11:00:00.000Z',
  ]);

  assert.deepEqual(sheetsSync.__test.snapshotToNewRow(snapshot), [
    'user-1',
    'Example User',
    'user@example.com',
    '22',
    'Google',
    'Android',
    '2026-09-18T10:00:00.000Z',
    '2026-09-18T11:00:00.000Z',
    'Active',
    'User',
  ]);
});


test('pending sync coalesces duplicate user events', () => {
  const existing = { userId: 'user-1', platform: 'iOS', force: false };
  assert.deepEqual(
    sheetsSync.__test.mergePendingSync(existing, { platform: 'android', force: true }),
    { userId: 'user-1', platform: 'Android', force: true },
  );
});

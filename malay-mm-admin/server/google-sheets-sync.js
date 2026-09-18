const crypto = require('crypto');

const db = require('./db');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_TAB_NAME = 'Users';
const DEFAULT_DATA_START_ROW = 5;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;
const DEFAULT_FLUSH_DELAY_MS = 5000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MIN_USER_SYNC_INTERVAL_MS = 5 * 60 * 1000;
const MAX_PENDING_USERS = 5000;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let cachedAccessTokenClientEmail = null;
let flushTimer = null;
let flushPromise = null;
const pendingUserSyncs = new Map();
const lastSuccessfulSyncAt = new Map();

function isEnabled(value = process.env.GOOGLE_SHEETS_SYNC_ENABLED) {
  return /^(1|true|yes)$/i.test(String(value || '').trim());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig() {
  const enabled = isEnabled();
  if (!enabled) return { enabled: false };

  const spreadsheetId = String(process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '').trim();
  const clientEmail = String(process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_SHEETS_PRIVATE_KEY || '')
    .replace(/\\n/g, '\n')
    .trim();
  const tabName = String(process.env.GOOGLE_SHEETS_TAB_NAME || DEFAULT_TAB_NAME).trim();
  const dataStartRow = parsePositiveInteger(
    process.env.GOOGLE_SHEETS_DATA_START_ROW,
    DEFAULT_DATA_START_ROW,
  );
  const timeoutMs = Math.min(
    MAX_TIMEOUT_MS,
    Math.max(1000, parsePositiveInteger(process.env.GOOGLE_SHEETS_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)),
  );
  const flushDelayMs = Math.min(
    60_000,
    Math.max(1000, parsePositiveInteger(process.env.GOOGLE_SHEETS_FLUSH_DELAY_MS, DEFAULT_FLUSH_DELAY_MS)),
  );
  const batchSize = Math.min(
    500,
    Math.max(1, parsePositiveInteger(process.env.GOOGLE_SHEETS_BATCH_SIZE, DEFAULT_BATCH_SIZE)),
  );
  const minUserSyncIntervalMs = Math.min(
    60 * 60 * 1000,
    Math.max(
      30_000,
      parsePositiveInteger(
        process.env.GOOGLE_SHEETS_MIN_USER_SYNC_INTERVAL_MS,
        DEFAULT_MIN_USER_SYNC_INTERVAL_MS,
      ),
    ),
  );

  if (!/^[A-Za-z0-9_-]{20,}$/.test(spreadsheetId)) {
    throw new Error('GOOGLE_SHEETS_SPREADSHEET_ID is missing or invalid.');
  }
  if (!/^[^\s@]+@[^\s@]+$/.test(clientEmail)) {
    throw new Error('GOOGLE_SHEETS_CLIENT_EMAIL is missing or invalid.');
  }
  if (
    !privateKey.includes('-----BEGIN PRIVATE KEY-----') ||
    !privateKey.includes('-----END PRIVATE KEY-----')
  ) {
    throw new Error('GOOGLE_SHEETS_PRIVATE_KEY is missing or invalid.');
  }
  if (!tabName || tabName.length > 100) {
    throw new Error('GOOGLE_SHEETS_TAB_NAME must be between 1 and 100 characters.');
  }
  if (dataStartRow < 2 || dataStartRow > 1_000_000) {
    throw new Error('GOOGLE_SHEETS_DATA_START_ROW must be between 2 and 1000000.');
  }

  return {
    enabled: true,
    spreadsheetId,
    clientEmail,
    privateKey,
    tabName,
    dataStartRow,
    timeoutMs,
    flushDelayMs,
    batchSize,
    minUserSyncIntervalMs,
  };
}

function quoteSheetTitle(title) {
  return `'${String(title).replace(/'/g, "''")}'`;
}

function encodeRange(range) {
  return encodeURIComponent(range);
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function createServiceAccountJwt(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  const header = base64UrlJson({ alg: 'RS256', typ: 'JWT' });
  const claims = base64UrlJson({
    iss: config.clientEmail,
    scope: GOOGLE_SHEETS_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: nowSeconds,
    exp: nowSeconds + 3600,
  });
  const unsigned = `${header}.${claims}`;

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();

  return `${unsigned}.${signer.sign(config.privateKey).toString('base64url')}`;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function readResponseBody(response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function errorMessageFromBody(body) {
  if (body && typeof body === 'object') {
    const nested = body.error?.message || body.error_description || body.message;
    if (nested) return String(nested).slice(0, 300);
  }
  if (typeof body === 'string' && body) return body.slice(0, 300);
  return 'Unknown Google API error.';
}

async function getAccessToken(config) {
  const now = Date.now();
  if (
    cachedAccessToken &&
    cachedAccessTokenClientEmail === config.clientEmail &&
    cachedAccessTokenExpiresAt - now > 60_000
  ) {
    return cachedAccessToken;
  }

  const assertion = createServiceAccountJwt(config);
  const response = await fetchWithTimeout(
    GOOGLE_TOKEN_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }).toString(),
    },
    config.timeoutMs,
  );
  const body = await readResponseBody(response);

  if (!response.ok || !body?.access_token) {
    throw new Error(
      `Google service-account authentication failed (${response.status}): ${errorMessageFromBody(body)}`,
    );
  }

  const expiresInSeconds = Math.max(60, Number(body.expires_in) || 3600);
  cachedAccessToken = String(body.access_token);
  cachedAccessTokenClientEmail = config.clientEmail;
  cachedAccessTokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  return cachedAccessToken;
}

function clearTokenCache() {
  cachedAccessToken = null;
  cachedAccessTokenClientEmail = null;
  cachedAccessTokenExpiresAt = 0;
}

async function googleRequest(config, url, options = {}, allowAuthRetry = true) {
  const token = await getAccessToken(config);
  const response = await fetchWithTimeout(
    url,
    {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    },
    config.timeoutMs,
  );

  if (response.status === 401 && allowAuthRetry) {
    await readResponseBody(response);
    clearTokenCache();
    return googleRequest(config, url, options, false);
  }

  const body = await readResponseBody(response);
  if (!response.ok) {
    throw new Error(
      `Google Sheets API request failed (${response.status}): ${errorMessageFromBody(body)}`,
    );
  }
  return body;
}

function normalizePlatform(value) {
  const platform = String(value || '').trim().toLowerCase();
  if (platform === 'ios') return 'iOS';
  if (platform === 'android') return 'Android';
  return '';
}

function toIsoString(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function snapshotToManagedRow(snapshot) {
  return [
    snapshot.userId,
    snapshot.name,
    snapshot.email,
    snapshot.age,
    snapshot.loginMethod,
    snapshot.platform,
    snapshot.registeredAt,
    snapshot.lastLogin,
  ];
}

function snapshotToNewRow(snapshot) {
  return [...snapshotToManagedRow(snapshot), 'Active', 'User'];
}

async function getUserSnapshots(userItems) {
  if (!userItems.length) return [];

  const platformByUserId = new Map(
    userItems.map((item) => [String(item.userId), normalizePlatform(item.platform)]),
  );
  const userIds = [...platformByUserId.keys()];
  const result = await db.query(
    `SELECT
       u.id::text AS "userId",
       COALESCE(p.name, '') AS name,
       u.email,
       COALESCE(p.age::text, '') AS age,
       CASE
         WHEN u.password_hash IS NOT NULL
              AND EXISTS (
                SELECT 1
                  FROM user_identities i
                 WHERE i.user_id = u.id
                   AND i.provider = 'google'
              )
           THEN 'Google + Password'
         WHEN EXISTS (
                SELECT 1
                  FROM user_identities i
                 WHERE i.user_id = u.id
                   AND i.provider = 'google'
              )
           THEN 'Google'
         ELSE 'Password'
       END AS "loginMethod",
       u.created_at AS "registeredAt",
       COALESCE(
         (
           SELECT MAX(s.created_at)
             FROM user_sessions s
            WHERE s.user_id = u.id
         ),
         u.created_at
       ) AS "lastLogin"
     FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    WHERE u.id = ANY($1::uuid[])
    ORDER BY u.created_at ASC, u.id ASC`,
    [userIds],
  );

  return result.rows.map((row) => ({
    userId: String(row.userId),
    name: String(row.name || ''),
    email: String(row.email || ''),
    age: String(row.age || ''),
    loginMethod: String(row.loginMethod || 'Password'),
    platform: platformByUserId.get(String(row.userId)) || '',
    registeredAt: toIsoString(row.registeredAt),
    lastLogin: toIsoString(row.lastLogin),
  }));
}

function spreadsheetValuesBaseUrl(config) {
  return `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values`;
}

async function readSheetUserRows(config) {
  const columnRange = `${quoteSheetTitle(config.tabName)}!A${config.dataStartRow}:A`;
  const url =
    `${spreadsheetValuesBaseUrl(config)}/${encodeRange(columnRange)}` +
    '?majorDimension=COLUMNS&valueRenderOption=UNFORMATTED_VALUE';

  const body = await googleRequest(config, url);
  const ids = Array.isArray(body?.values?.[0]) ? body.values[0] : [];
  const rowByUserId = new Map();
  let duplicateCount = 0;

  ids.forEach((value, index) => {
    const userId = String(value || '').trim();
    if (!userId) return;
    if (rowByUserId.has(userId)) {
      duplicateCount += 1;
      return;
    }
    rowByUserId.set(userId, config.dataStartRow + index);
  });

  if (duplicateCount > 0) {
    console.warn(`[SheetsSync] Ignored ${duplicateCount} duplicate user ID row(s).`);
  }

  return rowByUserId;
}

async function verifySheetAccess() {
  const config = getConfig();
  if (!config.enabled) return { skipped: true, reason: 'disabled' };

  const probeRange = `${quoteSheetTitle(config.tabName)}!A1:A1`;
  const url =
    `${spreadsheetValuesBaseUrl(config)}/${encodeRange(probeRange)}` +
    '?majorDimension=ROWS&valueRenderOption=UNFORMATTED_VALUE';

  await googleRequest(config, url);
  return { ok: true };
}

async function batchUpdateExistingRows(config, updates) {
  if (!updates.length) return;

  const url = `${spreadsheetValuesBaseUrl(config)}:batchUpdate`;
  const data = updates.map(({ rowNumber, values }) => ({
    range: `${quoteSheetTitle(config.tabName)}!A${rowNumber}:H${rowNumber}`,
    majorDimension: 'ROWS',
    values: [values],
  }));

  await googleRequest(config, url, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data }),
  });
}

async function appendNewRows(config, rows) {
  if (!rows.length) return;

  const appendRange = `${quoteSheetTitle(config.tabName)}!A${config.dataStartRow}:J`;
  const url =
    `${spreadsheetValuesBaseUrl(config)}/${encodeRange(appendRange)}:append` +
    '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';

  await googleRequest(config, url, {
    method: 'POST',
    body: JSON.stringify({
      range: appendRange,
      majorDimension: 'ROWS',
      values: rows,
    }),
  });
}

async function syncUserBatch(userItems, options = {}) {
  const config = options.config || getConfig();
  if (!config.enabled) return { skipped: true, reason: 'disabled', synced: 0 };

  const now = Date.now();
  const eligible = userItems.filter((item) => {
    if (item.force) return true;
    const lastSyncedAt = lastSuccessfulSyncAt.get(String(item.userId)) || 0;
    return now - lastSyncedAt >= config.minUserSyncIntervalMs;
  });

  if (!eligible.length) return { skipped: true, reason: 'recently_synced', synced: 0 };

  const snapshots = await getUserSnapshots(eligible);
  if (!snapshots.length) return { skipped: true, reason: 'users_not_found', synced: 0 };

  const rowByUserId = await readSheetUserRows(config);
  const updates = [];
  const appends = [];

  for (const snapshot of snapshots) {
    const existingRow = rowByUserId.get(snapshot.userId);
    if (existingRow) {
      // A:H are backend-managed. I:J (Status/Role) are intentionally admin-managed.
      updates.push({ rowNumber: existingRow, values: snapshotToManagedRow(snapshot) });
    } else {
      appends.push(snapshotToNewRow(snapshot));
    }
  }

  await batchUpdateExistingRows(config, updates);
  await appendNewRows(config, appends);

  const syncedAt = Date.now();
  for (const snapshot of snapshots) lastSuccessfulSyncAt.set(snapshot.userId, syncedAt);

  if (lastSuccessfulSyncAt.size > MAX_PENDING_USERS * 2) {
    const cutoff = syncedAt - Math.max(config.minUserSyncIntervalMs * 2, 10 * 60 * 1000);
    for (const [userId, timestamp] of lastSuccessfulSyncAt) {
      if (timestamp < cutoff) lastSuccessfulSyncAt.delete(userId);
      if (lastSuccessfulSyncAt.size <= MAX_PENDING_USERS) break;
    }
  }

  return {
    synced: snapshots.length,
    updated: updates.length,
    appended: appends.length,
  };
}

function mergePendingSync(existing, options) {
  return {
    userId: existing.userId,
    platform: normalizePlatform(options.platform) || existing.platform || '',
    force: Boolean(existing.force || options.force),
  };
}

function scheduleFlush(config) {
  if (flushTimer || flushPromise) return;

  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushPendingUserSyncs().catch((error) => {
      console.error('[SheetsSync] Batch flush failed:', error.message);
    });
  }, config.flushDelayMs);
  flushTimer.unref?.();
}

function scheduleUserSheetSync(userId, options = {}) {
  if (!userId || !isEnabled()) return false;

  let config;
  try {
    config = getConfig();
  } catch (error) {
    console.error('[SheetsSync] Configuration invalid:', error.message);
    return false;
  }

  const key = String(userId);
  if (!options.force) {
    const lastSyncedAt = lastSuccessfulSyncAt.get(key) || 0;
    if (Date.now() - lastSyncedAt < config.minUserSyncIntervalMs) return false;
  }

  const existing = pendingUserSyncs.get(key);
  if (!existing && pendingUserSyncs.size >= MAX_PENDING_USERS) {
    console.warn('[SheetsSync] Pending queue is full; skipped one sync request.');
    return false;
  }

  pendingUserSyncs.set(
    key,
    existing
      ? mergePendingSync(existing, options)
      : {
          userId: key,
          platform: normalizePlatform(options.platform),
          force: Boolean(options.force),
        },
  );

  scheduleFlush(config);
  return true;
}

async function flushPendingUserSyncs() {
  if (flushPromise) return flushPromise;

  flushPromise = (async () => {
    const config = getConfig();
    if (!config.enabled) return { synced: 0 };

    let totalSynced = 0;
    while (pendingUserSyncs.size > 0) {
      const items = [...pendingUserSyncs.values()].slice(0, config.batchSize);
      for (const item of items) pendingUserSyncs.delete(item.userId);

      try {
        const result = await syncUserBatch(items, { config });
        totalSynced += Number(result.synced || 0);
      } catch (error) {
        // PostgreSQL remains authoritative. Do not block app traffic or retry in a tight loop.
        console.error('[SheetsSync] Batch sync failed:', error.message);
      }
    }

    return { synced: totalSynced };
  })().finally(() => {
    flushPromise = null;
    if (pendingUserSyncs.size > 0 && isEnabled()) {
      try {
        scheduleFlush(getConfig());
      } catch (error) {
        console.error('[SheetsSync] Configuration invalid:', error.message);
      }
    }
  });

  return flushPromise;
}

async function syncUserToSheet(userId, options = {}) {
  if (!userId) return { skipped: true, reason: 'missing_user_id', synced: 0 };
  return syncUserBatch([
    {
      userId: String(userId),
      platform: normalizePlatform(options.platform),
      force: options.force !== false,
    },
  ]);
}

async function syncAllUsersToSheet(options = {}) {
  const config = getConfig();
  if (!config.enabled) throw new Error('Google Sheets sync is disabled.');

  const users = await db.query('SELECT id::text AS id FROM users ORDER BY created_at ASC, id ASC');
  let synced = 0;

  for (let index = 0; index < users.rows.length; index += config.batchSize) {
    const items = users.rows.slice(index, index + config.batchSize).map((row) => ({
      userId: String(row.id),
      platform: normalizePlatform(options.platform),
      force: true,
    }));
    const result = await syncUserBatch(items, { config });
    synced += Number(result.synced || 0);
  }

  return { synced };
}

module.exports = {
  flushPendingUserSyncs,
  getConfig,
  scheduleUserSheetSync,
  syncAllUsersToSheet,
  syncUserToSheet,
  verifySheetAccess,
  __test: {
    clearTokenCache,
    mergePendingSync,
    normalizePlatform,
    quoteSheetTitle,
    snapshotToManagedRow,
    snapshotToNewRow,
  },
};

const crypto = require('crypto');

const db = require('./db');

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DEFAULT_TAB_NAME = 'Users';
const DEFAULT_DATA_START_ROW = 5;
const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;
let cachedAccessTokenClientEmail = null;
const pendingUserSyncs = new Map();

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
  const platform = String(value || '').trim().slice(0, 40);
  return platform || 'Mobile';
}

function toIsoString(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

async function getUserSnapshot(userId, platform) {
  const result = await db.query(
    `SELECT
       u.id::text AS "userId",
       COALESCE(p.name, '') AS name,
       u.email,
       COALESCE(p.phone_number, '') AS phone,
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
    WHERE u.id = $1
    LIMIT 1`,
    [userId],
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    userId: String(row.userId),
    name: String(row.name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    loginMethod: String(row.loginMethod || 'Password'),
    platform: normalizePlatform(platform),
    registeredAt: toIsoString(row.registeredAt),
    lastLogin: toIsoString(row.lastLogin),
    status: 'Active',
    role: 'User',
  };
}

function snapshotToRow(snapshot) {
  return [
    snapshot.userId,
    snapshot.name,
    snapshot.email,
    snapshot.phone,
    snapshot.loginMethod,
    snapshot.platform,
    snapshot.registeredAt,
    snapshot.lastLogin,
    snapshot.status,
    snapshot.role,
  ];
}

function spreadsheetValuesBaseUrl(config) {
  return `${GOOGLE_SHEETS_API_BASE}/${encodeURIComponent(config.spreadsheetId)}/values`;
}

async function findExistingRow(config, userId) {
  const columnRange = `${quoteSheetTitle(config.tabName)}!A${config.dataStartRow}:A`;
  const url =
    `${spreadsheetValuesBaseUrl(config)}/${encodeRange(columnRange)}` +
    '?majorDimension=COLUMNS&valueRenderOption=UNFORMATTED_VALUE';

  const body = await googleRequest(config, url);
  const ids = Array.isArray(body?.values?.[0]) ? body.values[0] : [];
  const matches = [];

  ids.forEach((value, index) => {
    if (String(value) === String(userId)) matches.push(config.dataStartRow + index);
  });

  if (matches.length > 1) {
    console.warn('[SheetsSync] Duplicate user IDs found in the Google Sheet; updating the first row only.');
  }

  return matches[0] || null;
}

async function writeUserRow(config, rowNumber, rowValues) {
  const rowRange = `${quoteSheetTitle(config.tabName)}!A${rowNumber}:J${rowNumber}`;
  const url =
    `${spreadsheetValuesBaseUrl(config)}/${encodeRange(rowRange)}` +
    '?valueInputOption=RAW';

  await googleRequest(config, url, {
    method: 'PUT',
    body: JSON.stringify({
      range: rowRange,
      majorDimension: 'ROWS',
      values: [rowValues],
    }),
  });
}

async function appendUserRow(config, rowValues) {
  const appendRange = `${quoteSheetTitle(config.tabName)}!A${config.dataStartRow}:J`;
  const url =
    `${spreadsheetValuesBaseUrl(config)}/${encodeRange(appendRange)}:append` +
    '?valueInputOption=RAW&insertDataOption=INSERT_ROWS';

  await googleRequest(config, url, {
    method: 'POST',
    body: JSON.stringify({
      range: appendRange,
      majorDimension: 'ROWS',
      values: [rowValues],
    }),
  });
}

async function syncUserToSheet(userId, options = {}) {
  const config = getConfig();
  if (!config.enabled) return { skipped: true, reason: 'disabled' };

  const snapshot = await getUserSnapshot(userId, options.platform);
  if (!snapshot) return { skipped: true, reason: 'user_not_found' };

  const rowValues = snapshotToRow(snapshot);
  const existingRow = await findExistingRow(config, snapshot.userId);

  if (existingRow) {
    await writeUserRow(config, existingRow, rowValues);
    return { synced: true, action: 'updated', row: existingRow };
  }

  await appendUserRow(config, rowValues);
  return { synced: true, action: 'appended' };
}

function scheduleUserSheetSync(userId, options = {}) {
  if (!userId || !isEnabled()) return;

  const key = String(userId);
  const previous = pendingUserSyncs.get(key) || Promise.resolve();

  const next = previous
    .catch(() => {})
    .then(() => syncUserToSheet(key, options))
    .catch((error) => {
      console.error('[SheetsSync] User sync failed:', error.message);
    })
    .finally(() => {
      if (pendingUserSyncs.get(key) === next) pendingUserSyncs.delete(key);
    });

  pendingUserSyncs.set(key, next);
}

async function syncAllUsersToSheet(options = {}) {
  const config = getConfig();
  if (!config.enabled) {
    throw new Error('Google Sheets sync is disabled.');
  }

  const users = await db.query('SELECT id FROM users ORDER BY created_at ASC, id ASC');
  let synced = 0;

  for (const row of users.rows) {
    await syncUserToSheet(row.id, options);
    synced += 1;
  }

  return { synced };
}

module.exports = {
  getConfig,
  scheduleUserSheetSync,
  syncAllUsersToSheet,
  syncUserToSheet,
  __test: {
    clearTokenCache,
    createServiceAccountJwt,
    normalizePlatform,
    quoteSheetTitle,
    snapshotToRow,
  },
};

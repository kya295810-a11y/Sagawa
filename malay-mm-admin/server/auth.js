const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const db = require('./db');
const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');

const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const ADMIN_NAME = String(process.env.ADMIN_NAME || '').trim() || 'Admin';
const ADMIN_PASSWORD_HASH = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
const SESSION_SECRET = String(process.env.SESSION_SECRET || '').trim();
const ADMIN_ORIGIN = String(process.env.ADMIN_ORIGIN || '').trim().replace(/\/$/, '');
const RP_ID = String(process.env.WEBAUTHN_RP_ID || '').trim() || deriveOriginHost(ADMIN_ORIGIN);
const RP_NAME = String(process.env.WEBAUTHN_RP_NAME || 'Sagawa Admin').trim();
const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const MAX_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = readPositiveDuration('SESSION_TTL_MS', process.env.SESSION_TTL_MS, 8 * 60 * 60 * 1000, MAX_SESSION_TTL_MS);
const CHALLENGE_TTL_MS = readPositiveDuration('WEBAUTHN_CHALLENGE_TTL_MS', process.env.WEBAUTHN_CHALLENGE_TTL_MS, 5 * 60 * 1000, MAX_CHALLENGE_TTL_MS);
const VERIFICATION_CODE_TTL_MS = readPositiveDuration('VERIFICATION_CODE_TTL_MS', process.env.VERIFICATION_CODE_TTL_MS, 5 * 60 * 1000, MAX_VERIFICATION_CODE_TTL_MS);
const VERIFICATION_CODE_MAX_ATTEMPTS = 5;
const MAX_RECENT_AUTH_TTL_MS = 60 * 60 * 1000;
const RECENT_AUTH_TTL_MS = readPositiveDuration(
  'ADMIN_RECENT_AUTH_TTL_MS',
  process.env.ADMIN_RECENT_AUTH_TTL_MS,
  15 * 60 * 1000,
  MAX_RECENT_AUTH_TTL_MS,
);
const COOKIE_NAME = 'sagawa_admin_session';
const VERIFICATION_CODE_COOKIE_NAME = 'sagawa_admin_verification';
const USER_ID = crypto.createHash('sha256').update(ADMIN_EMAIL).digest('base64url');
const ENV_PATH = path.join(__dirname, '..', '.env');
const MIN_BCRYPT_ROUNDS = 12;

function deriveOriginHost(origin) {
  if (!origin) return '';
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

function isValidAdminEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function isValidBcryptHash(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  try {
    const rounds = bcrypt.getRounds(value);
    bcrypt.getSalt(value);
    const supportedPrefix = ['$2a$', '$2b$', '$2y$'].some((prefix) => value.startsWith(prefix));
    return supportedPrefix && Number.isInteger(rounds) && rounds >= MIN_BCRYPT_ROUNDS && rounds <= 31;
  } catch {
    return false;
  }
}

function readPositiveDuration(name, rawValue, defaultValue, maxAllowedMs) {
  const numericValue = Number(rawValue ?? defaultValue);

  if (!Number.isFinite(numericValue) || numericValue <= 0 || numericValue > maxAllowedMs) {
    throw new Error(`${name} must be a finite number greater than zero and less than or equal to ${maxAllowedMs}.`);
  }

  return numericValue;
}

function validateConfiguration() {
  if (!ADMIN_EMAIL) {
    throw new Error('Missing ADMIN_EMAIL. Configure it in the local .env file before starting the server.');
  }

  if (!isValidAdminEmail(ADMIN_EMAIL)) {
    throw new Error('ADMIN_EMAIL must be a valid email address stored in the local .env file.');
  }

  if (!ADMIN_PASSWORD_HASH || !isValidBcryptHash(ADMIN_PASSWORD_HASH)) {
    throw new Error('ADMIN_PASSWORD_HASH must be a valid bcrypt hash stored in the local .env file.');
  }

  if (SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters and stored in the local .env file.');
  }

  if (!ADMIN_ORIGIN) {
    throw new Error('Missing ADMIN_ORIGIN. Configure it in the local .env file before starting the server.');
  }

  try {
    const parsed = new URL(ADMIN_ORIGIN);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('ADMIN_ORIGIN must use http or https.');
    }
  } catch {
    throw new Error('ADMIN_ORIGIN must be a valid absolute URL like http://localhost:5173 or https://admin.example.com.');
  }

  if (!RP_ID) {
    throw new Error('WEBAUTHN_RP_ID must be set to the effective relying party domain, or it will be derived from ADMIN_ORIGIN.');
  }
}

validateConfiguration();

function loadAdminPasswordHash() {
  return ADMIN_PASSWORD_HASH;
}

let adminPasswordHash = loadAdminPasswordHash();

const sessions = new Map();
const pendingChallenges = new Map();
const verificationStates = new Map();

function pruneVerificationStates() {
  const now = Date.now();
  for (const [key, state] of verificationStates) {
    if (state.expiresAt <= now) verificationStates.delete(key);
  }
}

function verificationStateKey(stateId) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(String(stateId || '')).digest('hex');
}

function verificationCodeHash(stateId, code) {
  return crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${String(stateId || '')}:${String(code || '')}`)
    .digest('hex');
}

function createCodeState(purpose) {
  pruneVerificationStates();

  if (verificationStates.size >= 100) {
    const oldestKey = verificationStates.keys().next().value;
    if (oldestKey) verificationStates.delete(oldestKey);
  }

  const stateId = crypto.randomBytes(32).toString('base64url');
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  verificationStates.set(verificationStateKey(stateId), {
    purpose,
    codeHash: verificationCodeHash(stateId, code),
    expiresAt: Date.now() + VERIFICATION_CODE_TTL_MS,
    attempts: 0,
  });

  return {
    stateId,
    code,
    expiresAt: Date.now() + VERIFICATION_CODE_TTL_MS,
  };
}

function createVerificationState() {
  return createCodeState('admin-login');
}

function createPasswordResetState() {
  return createCodeState('password-reset');
}

function hasVerificationState(stateId, expectedPurpose = null) {
  pruneVerificationStates();
  const state = verificationStates.get(verificationStateKey(stateId));
  if (!state) return false;
  return expectedPurpose ? state.purpose === expectedPurpose : true;
}

function validateVerificationCode(stateId, code, expectedPurpose = 'admin-login') {
  pruneVerificationStates();
  const key = verificationStateKey(stateId);
  const state = verificationStates.get(key);

  if (!state || state.purpose !== expectedPurpose) {
    return { valid: false, reason: 'invalid_state' };
  }

  if (state.expiresAt <= Date.now()) {
    verificationStates.delete(key);
    return { valid: false, reason: 'expired' };
  }

  state.attempts += 1;
  if (state.attempts > VERIFICATION_CODE_MAX_ATTEMPTS) {
    verificationStates.delete(key);
    return { valid: false, reason: 'too_many_attempts' };
  }

  const submittedHash = verificationCodeHash(stateId, String(code || '').trim());
  const expectedHash = state.codeHash;
  const matches =
    submittedHash.length === expectedHash.length &&
    crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(expectedHash));

  if (!matches) {
    return { valid: false, reason: 'invalid_code' };
  }

  verificationStates.delete(key);
  return { valid: true };
}

function validateResetCode(stateId, code) {
  return validateVerificationCode(stateId, code, 'password-reset');
}

async function loadPasskeys() {
  const result = await db.query(
    'SELECT id, public_key, counter, transports FROM passkeys ORDER BY id',
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    publicKey: Buffer.from(String(row.public_key), 'base64url'),
    counter: Number(row.counter || 0),
    transports: Array.isArray(row.transports) ? row.transports : [],
  }));
}

async function findPasskey(id) {
  const result = await db.query(
    'SELECT id, public_key, counter, transports FROM passkeys WHERE id = $1 LIMIT 1',
    [String(id || '')],
  );
  const row = result.rows[0];
  if (!row) return null;

  return {
    id: String(row.id),
    publicKey: Buffer.from(String(row.public_key), 'base64url'),
    counter: Number(row.counter || 0),
    transports: Array.isArray(row.transports) ? row.transports : [],
  };
}

async function savePasskey(credential, transports = []) {
  await db.query(
    `INSERT INTO passkeys (id, public_key, counter, transports)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (id) DO UPDATE
     SET public_key = EXCLUDED.public_key,
         counter = EXCLUDED.counter,
         transports = EXCLUDED.transports`,
    [
      credential.id,
      Buffer.from(credential.publicKey).toString('base64url'),
      Number(credential.counter || 0),
      JSON.stringify(Array.isArray(transports) ? transports : []),
    ],
  );
}

async function updatePasskeyCounter(id, counter) {
  await db.query(
    'UPDATE passkeys SET counter = $2 WHERE id = $1',
    [String(id), Number(counter || 0)],
  );
}

function writeJsonAtomically(filePath, data) {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });

  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );

  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch {
      // Best-effort cleanup only
    }
    throw error;
  }
}

function persistAdminPasswordHash(nextHash) {
  const stat = fs.lstatSync(ENV_PATH);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('Local .env path must be a regular file.');
  }

  const current = fs.readFileSync(ENV_PATH, 'utf8');
  const linePattern = /^(\s*(?:export\s+)?ADMIN_PASSWORD_HASH\s*=).*$/gm;
  const matches = [...current.matchAll(linePattern)];
  if (matches.length !== 1) {
    throw new Error('Local .env must contain exactly one ADMIN_PASSWORD_HASH entry.');
  }

  const next = current.replace(linePattern, (_match, prefix) => `${prefix}${nextHash}`);
  const tempPath = path.join(path.dirname(ENV_PATH), `.${path.basename(ENV_PATH)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tempPath, next, { encoding: 'utf8', mode: 0o600 });
    fs.chmodSync(tempPath, 0o600);
    fs.renameSync(tempPath, ENV_PATH);
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

function replaceAdminPasswordHash(nextHash) {
  if (!isValidBcryptHash(nextHash)) {
    throw new Error('Invalid bcrypt hash provided for the admin password.');
  }

  adminPasswordHash = nextHash;
  persistAdminPasswordHash(nextHash);
  return adminPasswordHash;
}

function validatePasswordPolicy(password) {
  const value = typeof password === 'string' ? password : '';

  if (value.length < 12) {
    return 'Password must be at least 12 characters long.';
  }

  if (!/[a-z]/.test(value)) {
    return 'Password must include at least one lowercase letter.';
  }

  if (!/[A-Z]/.test(value)) {
    return 'Password must include at least one uppercase letter.';
  }

  if (!/\d/.test(value)) {
    return 'Password must include at least one number.';
  }

  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include at least one special character.';
  }

  return '';
}

function parseCookies(header = '') {
  const cookies = {};

  for (const part of String(header).split(';')) {
    const trimmed = part.trim();
    if (!trimmed) {
      continue;
    }

    const index = trimmed.indexOf('=');
    if (index === -1) {
      continue;
    }

    const name = trimmed.slice(0, index).trim();
    const encodedValue = trimmed.slice(index + 1).trim();

    if (!name || !encodedValue) {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(encodedValue);
    } catch {
      continue;
    }
  }

  return cookies;
}


function createChallenge(type) {
  const now = Date.now();
  for (const [key, entry] of pendingChallenges) {
    if (entry.expiresAt <= now) pendingChallenges.delete(key);
  }

  if (pendingChallenges.size >= 100) {
    const oldestKey = pendingChallenges.keys().next().value;
    if (oldestKey) pendingChallenges.delete(oldestKey);
  }

  const challenge = crypto.randomBytes(32);
  const challengeKey = challenge.toString('base64url');
  pendingChallenges.set(challengeKey, {
    type,
    challenge,
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
    used: false,
  });
  return challenge;
}

function consumeChallenge(challengeValue, expectedType) {
  const entry = pendingChallenges.get(challengeValue);
  if (!entry) {
    throw new Error('Challenge not found or already used.');
  }

  if (entry.type !== expectedType) {
    throw new Error('Challenge type mismatch.');
  }

  if (entry.expiresAt <= Date.now()) {
    pendingChallenges.delete(challengeValue);
    throw new Error('Challenge expired.');
  }

  if (entry.used) {
    pendingChallenges.delete(challengeValue);
    throw new Error('Challenge has already been used.');
  }

  entry.used = true;
  pendingChallenges.delete(challengeValue);
  return entry.challenge;
}

function extractChallengeFromClientData(response, expectedType) {
  if (!response || typeof response !== 'object' || typeof response.clientDataJSON !== 'string') {
    throw new Error('Invalid WebAuthn response.');
  }

  let clientData;
  try {
    clientData = JSON.parse(Buffer.from(response.clientDataJSON, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid WebAuthn client data.');
  }

  if (clientData.type !== expectedType) {
    throw new Error('Unexpected WebAuthn request type.');
  }

  if (typeof clientData.challenge !== 'string' || !clientData.challenge) {
    throw new Error('Missing challenge in WebAuthn client data.');
  }

  return clientData.challenge;
}

function createSession(options = {}) {
  const now = Date.now();
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionKey(token), {
    expiresAt: now + SESSION_TTL_MS,
    createdAt: now,
    strongAuthAt: Number(options.strongAuthAt || now),
    authMethod: String(options.authMethod || 'admin'),
  });
  return token;
}

function sessionKey(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

function getSession(req) {
  const cookieToken = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  const authorization = String(req.headers.authorization || '');
  const bearerToken = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const token = cookieToken || bearerToken;
  const session = token ? sessions.get(sessionKey(token)) : null;

  if (!session || session.expiresAt <= Date.now()) {
    if (token) {
      sessions.delete(sessionKey(token));
    }
    return null;
  }

  return { token, session };
}

function destroySession(req) {
  const current = getSession(req);
  if (current) {
    sessions.delete(sessionKey(current.token));
  }
}

function destroyAllSessions() {
  sessions.clear();
}

function getSessionCookieAttributes() {
  const productionHttps = process.env.NODE_ENV === 'production' && ADMIN_ORIGIN.startsWith('https://');
  return productionHttps ? 'SameSite=None; Secure' : 'SameSite=Lax';
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; ${getSessionCookieAttributes()}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; ${getSessionCookieAttributes()}`,
  );
}

function requireAdmin(req, res, next) {
  if (!getSession(req)) {
    console.warn('[Auth] Unauthorized request.');
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  return next();
}

function requireRecentAdminAuth(req, res, next) {
  const current = getSession(req);
  if (!current) {
    console.warn('[Auth] Recent-auth request rejected: no admin session.');
    return res.status(401).json({
      success: false,
      code: 'authentication_required',
      message: 'Authentication required.',
    });
  }

  const strongAuthAt = Number(current.session.strongAuthAt || 0);
  if (!strongAuthAt || Date.now() - strongAuthAt > RECENT_AUTH_TTL_MS) {
    console.warn('[Auth] Recent-auth request rejected: verification expired.');
    return res.status(403).json({
      success: false,
      code: 'recent_auth_required',
      message: 'Please verify your identity again before changing security settings.',
    });
  }

  return next();
}

function isAdminAuthenticated(req) {
  return Boolean(getSession(req));
}

function getAuthenticatedUser(req) {
  const session = getSession(req);
  if (!session) {
    return null;
  }

  return {
    name: ADMIN_NAME || 'Admin',
    email: ADMIN_EMAIL,
  };
}

async function verifyPassword(password) {
  if (typeof password !== 'string' || password.length === 0) {
    return false;
  }

  return bcrypt.compare(password, adminPasswordHash);
}

async function login(email, password) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const submittedPassword = typeof password === 'string' ? password : '';
  const passwordMatches = await bcrypt.compare(submittedPassword, adminPasswordHash);
  return normalizedEmail === ADMIN_EMAIL && passwordMatches;
}

async function beginRegistration(req) {
  const session = getSession(req);
  if (!session) {
    throw new Error('Authentication required.');
  }

  const credentials = await loadPasskeys();
  const challenge = createChallenge('webauthn.create');
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: ADMIN_EMAIL,
    userDisplayName: ADMIN_NAME || 'Admin',
    userID: Buffer.from(USER_ID),
    attestationType: 'none',
    challenge,
    excludeCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'required',
    },
  });
}

async function finishRegistration(req, response) {
  const session = getSession(req);
  if (!session) {
    throw new Error('Authentication required.');
  }

  const challengeValue = extractChallengeFromClientData(response, 'webauthn.create');
  const expectedChallenge = consumeChallenge(challengeValue, 'webauthn.create');

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ADMIN_ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('Passkey registration verification failed.');
  }

  const credential = verification.registrationInfo.credential;
  await savePasskey(
    credential,
    response.response?.transports || [],
  );
  return true;
}

async function beginAuthentication() {
  const credentials = await loadPasskeys();
  const challenge = createChallenge('webauthn.get');
  return generateAuthenticationOptions({
    rpID: RP_ID,
    challenge,
    allowCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
    userVerification: 'required',
  });
}

async function finishAuthentication(response) {
  const credential = await findPasskey(response?.id);
  if (!credential) {
    throw new Error('Passkey not found.');
  }

  const challengeValue = extractChallengeFromClientData(response, 'webauthn.get');
  const expectedChallenge = consumeChallenge(challengeValue, 'webauthn.get');

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ADMIN_ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey, 'base64url'),
      counter: credential.counter,
      transports: credential.transports,
    },
  });

  if (!verification.verified) {
    throw new Error('Passkey authentication verification failed.');
  }

  await updatePasskeyCounter(
    credential.id,
    verification.authenticationInfo.newCounter,
  );
  return true;
}

module.exports = {
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_ORIGIN,
  COOKIE_NAME,
  VERIFICATION_CODE_COOKIE_NAME,
  SESSION_TTL_MS,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_CODE_MAX_ATTEMPTS,
  beginAuthentication,
  beginRegistration,
  clearSessionCookie,
  createPasswordResetState,
  createSession,
  createVerificationState,
  destroyAllSessions,
  destroySession,
  finishAuthentication,
  finishRegistration,
  getAuthenticatedUser,
  hasVerificationState,
  isAdminAuthenticated,
  login,
  replaceAdminPasswordHash,
  requireAdmin,
  requireRecentAdminAuth,
  setSessionCookie,
  validatePasswordPolicy,
  validateResetCode,
  validateVerificationCode,
  verifyPassword,
};

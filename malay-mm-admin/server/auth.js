const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} = require('@simplewebauthn/server');

const ADMIN_EMAIL = 'kya295810@gmail.com';
const ADMIN_NAME = String(process.env.ADMIN_NAME || '').trim() || 'Admin';
const ADMIN_PASSWORD = 'Zin295810@';
const SESSION_SECRET = 'sagawa-admin-local-session-key-change-before-production';
const ADMIN_ORIGIN = String(process.env.ADMIN_ORIGIN || '').trim().replace(/\/$/, '');
const RP_ID = String(process.env.WEBAUTHN_RP_ID || '').trim() || (ADMIN_ORIGIN ? new URL(ADMIN_ORIGIN).hostname : '');
const RP_NAME = String(process.env.WEBAUTHN_RP_NAME || 'Sagawa Admin').trim();
const MAX_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CHALLENGE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = readPositiveDuration('SESSION_TTL_MS', process.env.SESSION_TTL_MS, 8 * 60 * 60 * 1000, MAX_SESSION_TTL_MS);
const CHALLENGE_TTL_MS = readPositiveDuration('WEBAUTHN_CHALLENGE_TTL_MS', process.env.WEBAUTHN_CHALLENGE_TTL_MS, 5 * 60 * 1000, MAX_CHALLENGE_TTL_MS);
const COOKIE_NAME = 'sagawa_admin_session';
const USER_ID = crypto.createHash('sha256').update(ADMIN_EMAIL).digest('base64url');
const ADMIN_AUTH_FILE = path.join(__dirname, 'data', 'admin-auth.json');



function isValidBcryptHash(value) {
  return typeof value === 'string'
    && /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(value);
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

  if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 6) {
    throw new Error('ADMIN_PASSWORD must be at least 6 characters and stored in the local .env file.');
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

const sessions = new Map();
const pendingChallenges = new Map();
let credentials = [];
const credentialsFile = path.join(__dirname, 'data', 'passkeys.json');

function loadCredentials() {
  try {
    const raw = fs.readFileSync(credentialsFile, 'utf8');
    if (!raw.trim()) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      throw new Error('Passkey data is not a JSON array.');
    }

    return parsed;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
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
  const payload = { passwordHash: nextHash, updatedAt: new Date().toISOString() };
  writeJsonAtomically(ADMIN_AUTH_FILE, payload);
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

credentials = loadCredentials();

function createChallenge(type) {
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

function createSession() {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionKey(token), {
    expiresAt: Date.now() + SESSION_TTL_MS,
    createdAt: Date.now(),
  });
  return token;
}

function sessionKey(token) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(token).digest('hex');
}

function getSession(req) {
  const token = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
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

function setSessionCookie(res, token) {
  const secureFlag = ADMIN_ORIGIN.startsWith('https://') || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}; Path=/; HttpOnly; SameSite=Lax${secureFlag}`,
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${ADMIN_ORIGIN.startsWith('https://') || process.env.NODE_ENV === 'production' ? '; Secure' : ''}`,
  );
}

function requireAdmin(req, res, next) {
  if (!getSession(req)) {
    console.error('[Auth] Unauthorized request:', req.method, req.originalUrl);
    return res.status(401).json({ success: false, message: 'Authentication required.' });
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

  return (
    normalizedEmail === ADMIN_EMAIL &&
    submittedPassword === ADMIN_PASSWORD
  );
}

function saveCredentials(nextCredentials) {
  const normalized = nextCredentials.map((credential) => ({
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports || [],
  }));

  writeJsonAtomically(credentialsFile, normalized);
  credentials = normalized;
}

function beginRegistration(req) {
  const session = getSession(req);
  if (!session) {
    throw new Error('Authentication required.');
  }

  const challenge = createChallenge('webauthn.create');
  const options = generateRegistrationOptions({
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

  return options;
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
    throw new Error('Passkey registration was not verified.');
  }

  const { credential } = verification.registrationInfo;
  saveCredentials([
    ...credentials.filter((item) => item.id !== credential.id),
    {
      id: credential.id,
      publicKey: credential.publicKey,
      counter: credential.counter,
      transports: response.response.transports || [],
    },
  ]);
}

function beginAuthentication() {
  if (!credentials.length) {
    throw new Error('No passkey has been enrolled yet.');
  }

  const challenge = createChallenge('webauthn.get');
  const options = generateAuthenticationOptions({
    rpID: RP_ID,
    challenge,
    allowCredentials: credentials.map((credential) => ({
      id: credential.id,
      transports: credential.transports,
    })),
    userVerification: 'required',
  });

  return options;
}

async function finishAuthentication(response) {
  const challengeValue = extractChallengeFromClientData(response, 'webauthn.get');
  const expectedChallenge = consumeChallenge(challengeValue, 'webauthn.get');

  const credentialRecord = credentials.find((item) => item.id === response.id);
  if (!credentialRecord) {
    throw new Error('Unknown passkey.');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ADMIN_ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: credentialRecord.id,
      publicKey: Buffer.from(credentialRecord.publicKey, 'base64url'),
      counter: credentialRecord.counter,
      transports: credentialRecord.transports,
    },
    requireUserVerification: true,
  });

  if (!verification.verified) {
    throw new Error('Passkey authentication failed.');
  }

  credentialRecord.counter = verification.authenticationInfo.newCounter;
  saveCredentials(credentials);
  return true;
}

module.exports = {
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_ORIGIN,
  COOKIE_NAME,
  SESSION_TTL_MS,
  beginAuthentication,
  beginRegistration,
  clearSessionCookie,
  createSession,
  destroySession,
  finishAuthentication,
  finishRegistration,
  getAuthenticatedUser,
  isAdminAuthenticated,
  login,
  requireAdmin,
  replaceAdminPasswordHash,
  setSessionCookie,
  validatePasswordPolicy,
  verifyPassword,
};

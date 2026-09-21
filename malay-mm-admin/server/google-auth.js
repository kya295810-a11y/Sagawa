const crypto = require('crypto');

const GOOGLE_AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GOOGLE_JWKS_ENDPOINT = 'https://www.googleapis.com/oauth2/v3/certs';

const STATE_TTL_MS = 10 * 60 * 1000;
const NATIVE_NONCE_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_SECONDS = 60;
const DEFAULT_JWKS_TTL_MS = 60 * 60 * 1000;
const MAX_JWKS_TTL_MS = 24 * 60 * 60 * 1000;

let jwksCache = {
  expiresAt: 0,
  keys: [],
};

function authError(message, statusCode = 400, code = 'google_auth_error') {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw authError(`${name} is not configured.`, 503, 'google_auth_not_configured');
  return value;
}

function getGoogleConfig() {
  return {
    clientId: requiredEnv('GOOGLE_CLIENT_ID'),
    clientSecret: requiredEnv('GOOGLE_CLIENT_SECRET'),
    redirectUri: requiredEnv('GOOGLE_REDIRECT_URI'),
    appRedirectUri: String(process.env.GOOGLE_APP_REDIRECT_URI || 'sagawa://auth/google').trim(),
  };
}

function isGoogleAuthConfigured() {
  return Boolean(
    String(process.env.GOOGLE_CLIENT_ID || '').trim() &&
      String(process.env.GOOGLE_CLIENT_SECRET || '').trim() &&
      String(process.env.GOOGLE_REDIRECT_URI || '').trim(),
  );
}

function getGoogleAppRedirectUri() {
  return String(process.env.GOOGLE_APP_REDIRECT_URI || 'sagawa://auth/google').trim();
}

function getStateSecret() {
  const secret = String(process.env.SESSION_SECRET || '');
  if (secret.length < 32) {
    throw authError(
      'SESSION_SECRET must be at least 32 characters before Google sign-in can be used.',
      503,
      'google_auth_not_configured',
    );
  }
  return secret;
}

function signState(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', getStateSecret()).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyState(state) {
  if (typeof state !== 'string' || !state.includes('.')) {
    throw authError('Invalid Google sign-in state.', 400, 'invalid_google_state');
  }

  const [encoded, signature, ...extra] = state.split('.');
  if (!encoded || !signature || extra.length) {
    throw authError('Invalid Google sign-in state.', 400, 'invalid_google_state');
  }

  const expected = crypto.createHmac('sha256', getStateSecret()).update(encoded).digest();
  let actual;
  try {
    actual = Buffer.from(signature, 'base64url');
  } catch {
    throw authError('Invalid Google sign-in state.', 400, 'invalid_google_state');
  }

  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw authError('Invalid Google sign-in state.', 400, 'invalid_google_state');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw authError('Invalid Google sign-in state.', 400, 'invalid_google_state');
  }

  if (
    payload?.v !== 1 ||
    typeof payload.nonce !== 'string' ||
    !payload.nonce ||
    !Number.isFinite(payload.exp) ||
    payload.exp < Date.now()
  ) {
    throw authError('Google sign-in state expired or is invalid.', 400, 'invalid_google_state');
  }

  return payload;
}

function createNativeGoogleConfig() {
  const webClientId = requiredEnv('GOOGLE_CLIENT_ID');
  const nonce = signState({
    v: 1,
    nonce: crypto.randomBytes(24).toString('base64url'),
    exp: Date.now() + NATIVE_NONCE_TTL_MS,
  });

  return { webClientId, nonce };
}

function createGoogleAuthorizationUrl() {
  const config = getGoogleConfig();
  const nonce = crypto.randomBytes(24).toString('base64url');
  const state = signState({
    v: 1,
    nonce,
    exp: Date.now() + STATE_TTL_MS,
  });

  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('include_granted_scopes', 'true');

  return url.toString();
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cacheTtlFromHeaders(response) {
  const cacheControl = response.headers.get('cache-control') || '';
  const match = cacheControl.match(/max-age=(\d+)/i);
  const parsed = match ? Number.parseInt(match[1], 10) * 1000 : DEFAULT_JWKS_TTL_MS;
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_JWKS_TTL_MS;
  return Math.min(parsed, MAX_JWKS_TTL_MS);
}

async function getGoogleJwks(forceRefresh = false) {
  if (!forceRefresh && jwksCache.keys.length && jwksCache.expiresAt > Date.now()) {
    return jwksCache.keys;
  }

  let response;
  try {
    response = await fetchWithTimeout(GOOGLE_JWKS_ENDPOINT, {
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw authError('Unable to verify Google identity right now.', 503, 'google_jwks_unavailable');
  }

  if (!response.ok) {
    throw authError('Unable to verify Google identity right now.', 503, 'google_jwks_unavailable');
  }

  const body = await response.json();
  if (!Array.isArray(body?.keys) || !body.keys.length) {
    throw authError('Google verification keys are unavailable.', 503, 'google_jwks_unavailable');
  }

  jwksCache = {
    keys: body.keys,
    expiresAt: Date.now() + cacheTtlFromHeaders(response),
  };

  return jwksCache.keys;
}

function decodeJwtPart(value) {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
  } catch {
    throw authError('Invalid Google identity token.', 401, 'invalid_google_token');
  }
}

function audienceMatches(aud, clientId) {
  if (Array.isArray(aud)) return aud.includes(clientId);
  return aud === clientId;
}

function parseClientIdList(value) {
  return String(value || '')
    .split(',')
    .map((clientId) => clientId.trim())
    .filter(Boolean);
}

function authorizedPartyMatches(authorizedParty, webClientId) {
  if (authorizedParty == null || authorizedParty === '') return true;
  if (typeof authorizedParty !== 'string') return false;

  const allowedClientIds = new Set([
    webClientId,
    ...parseClientIdList(process.env.GOOGLE_ANDROID_CLIENT_IDS),
  ]);
  return allowedClientIds.has(authorizedParty);
}

async function verifyGoogleIdToken(idToken, expectedNonce) {
  if (typeof idToken !== 'string' || idToken.length > 20_000) {
    throw authError('Invalid Google identity token.', 401, 'invalid_google_token');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw authError('Invalid Google identity token.', 401, 'invalid_google_token');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJwtPart(encodedHeader);
  const payload = decodeJwtPart(encodedPayload);

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw authError('Invalid Google identity token.', 401, 'invalid_google_token');
  }

  let keys = await getGoogleJwks(false);
  let jwk = keys.find((candidate) => candidate.kid === header.kid);
  if (!jwk) {
    keys = await getGoogleJwks(true);
    jwk = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!jwk) {
    throw authError('Unable to verify Google identity.', 401, 'invalid_google_token');
  }

  let key;
  try {
    key = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  } catch {
    throw authError('Unable to verify Google identity.', 503, 'google_jwks_unavailable');
  }

  const signingInput = Buffer.from(`${encodedHeader}.${encodedPayload}`, 'utf8');
  const signature = Buffer.from(encodedSignature, 'base64url');
  const validSignature = crypto.verify('RSA-SHA256', signingInput, key, signature);
  if (!validSignature) {
    throw authError('Invalid Google identity token.', 401, 'invalid_google_token');
  }

  const config = getGoogleConfig();
  const now = Math.floor(Date.now() / 1000);

  if (!['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss)) {
    throw authError('Invalid Google identity token issuer.', 401, 'invalid_google_token');
  }
  if (!audienceMatches(payload.aud, config.clientId)) {
    throw authError('Google identity token was issued for another application.', 401, 'invalid_google_token');
  }
  if (!authorizedPartyMatches(payload.azp, config.clientId)) {
    throw authError('Google identity token was issued for another application.', 401, 'invalid_google_token');
  }
  if (!Number.isFinite(payload.exp) || payload.exp < now - CLOCK_SKEW_SECONDS) {
    throw authError('Google identity token has expired.', 401, 'invalid_google_token');
  }
  if (Number.isFinite(payload.iat) && payload.iat > now + CLOCK_SKEW_SECONDS) {
    throw authError('Google identity token is not yet valid.', 401, 'invalid_google_token');
  }
  if (typeof expectedNonce === 'string' && expectedNonce) {
    verifyState(expectedNonce);
    if (payload.nonce !== expectedNonce) {
      throw authError('Google identity token nonce mismatch.', 401, 'invalid_google_token');
    }
  }
  if (payload.email_verified !== true || typeof payload.email !== 'string' || !payload.email) {
    throw authError('Google account email is not verified.', 401, 'invalid_google_token');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) {
    throw authError('Google account identifier is invalid.', 401, 'invalid_google_token');
  }

  return {
    sub: payload.sub,
    email: payload.email,
    emailVerified: true,
    hostedDomain: typeof payload.hd === 'string' ? payload.hd : null,
    name: typeof payload.name === 'string' ? payload.name : '',
    picture: typeof payload.picture === 'string' ? payload.picture : '',
  };
}

async function exchangeAuthorizationCode(code) {
  const config = getGoogleConfig();
  if (typeof code !== 'string' || !code || code.length > 4096) {
    throw authError('Invalid Google authorization code.', 400, 'invalid_google_code');
  }

  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });

  let response;
  try {
    response = await fetchWithTimeout(GOOGLE_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
  } catch {
    throw authError('Google authentication service is unavailable.', 503, 'google_token_exchange_failed');
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || typeof result?.id_token !== 'string') {
    throw authError('Google authorization could not be completed.', 401, 'google_token_exchange_failed');
  }

  return result.id_token;
}

async function authenticateGoogleCallback(code, state) {
  const statePayload = verifyState(state);
  const idToken = await exchangeAuthorizationCode(code);
  return verifyGoogleIdToken(idToken, statePayload.nonce);
}

module.exports = {
  authenticateGoogleCallback,
  createGoogleAuthorizationUrl,
  createNativeGoogleConfig,
  getGoogleAppRedirectUri,
  isGoogleAuthConfigured,
  verifyGoogleIdToken,
  __test: {
    authorizedPartyMatches,
    parseClientIdList,
  },
};

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('./db');

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BCRYPT_ROUNDS = 12;
const SESSION_MAX_PER_USER = Math.min(
  100,
  Math.max(1, Number.parseInt(process.env.MOBILE_SESSION_MAX_PER_USER || '5', 10) || 5),
);
const DUMMY_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxYMgTf7Q7q8G7g6Q5Q1o5sJ8eK';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return 'Password must be between 8 and 128 characters.';
  }
  return null;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function publicUser(row) {
  return { id: row.id, email: row.email };
}

async function createUserSession(client, userId) {
  const accessToken = createOpaqueToken();
  const refreshToken = createOpaqueToken();
  const expiresAt = new Date(Date.now() + ACCESS_TOKEN_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1::text, 0))', [userId]);
  await client.query('DELETE FROM user_sessions WHERE user_id = $1 AND refresh_expires_at <= NOW()', [userId]);
  await client.query(
    `INSERT INTO user_sessions
      (id, user_id, access_token_hash, refresh_token_hash, access_expires_at, refresh_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      crypto.randomUUID(),
      userId,
      tokenHash(accessToken),
      tokenHash(refreshToken),
      expiresAt,
      refreshExpiresAt,
    ],
  );

  await client.query(
    `DELETE FROM user_sessions
      WHERE id IN (
        SELECT id FROM user_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC
         OFFSET $2
      )`,
    [userId, SESSION_MAX_PER_USER],
  );

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAt.toISOString(),
  };
}

async function registerUser(emailValue, password) {
  const email = normalizeEmail(emailValue);
  if (!validateEmail(email)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      `INSERT INTO users (id, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, email`,
      [crypto.randomUUID(), email, passwordHash],
    );
    const user = userResult.rows[0];
    await client.query(
      `INSERT INTO profiles (user_id, name, profile_completed)
       VALUES ($1, '', false)`,
      [user.id],
    );
    const session = await createUserSession(client, user.id);
    await client.query('COMMIT');
    return { user: publicUser(user), ...session };
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const conflict = new Error('An account with this email already exists.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }
}

async function loginUser(emailValue, password) {
  const email = normalizeEmail(emailValue);
  const result = validateEmail(email)
    ? await db.query('SELECT id, email, password_hash FROM users WHERE lower(email) = $1', [email])
    : { rows: [] };
  const row = result.rows[0];
  const passwordMatches = await bcrypt.compare(
    typeof password === 'string' ? password : '',
    row?.password_hash || DUMMY_PASSWORD_HASH,
  );
  if (!row || !passwordMatches) return null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const session = await createUserSession(client, row.id);
    await client.query('COMMIT');
    return { user: publicUser(row), ...session };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function readBearerToken(req) {
  const authorization = String(req.headers.authorization || '');
  return authorization.match(/^Bearer\s+([^\s]+)$/i)?.[1] || null;
}

async function getMobileSession(req) {
  const token = readBearerToken(req);
  if (!token) return null;
  const result = await db.query(
    `SELECT s.id AS session_id, s.user_id, s.access_expires_at, u.email
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.access_token_hash = $1
        AND s.access_expires_at > NOW()
        AND s.refresh_expires_at > NOW()`,
    [tokenHash(token)],
  );
  return result.rows[0] || null;
}

async function requireMobileUser(req, res, next) {
  try {
    const session = await getMobileSession(req);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    req.mobileUser = { id: session.user_id, email: session.email, sessionId: session.session_id };
    return next();
  } catch (error) {
    return next(error);
  }
}

async function refreshMobileSession(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) return null;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT s.id, s.user_id, u.email
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.refresh_token_hash = $1
          AND s.refresh_expires_at > NOW()
        FOR UPDATE`,
      [tokenHash(refreshToken)],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query('DELETE FROM user_sessions WHERE id = $1', [row.id]);
    const session = await createUserSession(client, row.user_id);
    await client.query('COMMIT');
    return { user: publicUser({ id: row.user_id, email: row.email }), ...session };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function logoutMobileSession(req) {
  const token = readBearerToken(req);
  if (!token) return;
  await db.query('DELETE FROM user_sessions WHERE access_token_hash = $1', [tokenHash(token)]);
}

module.exports = {
  getMobileSession,
  loginUser,
  logoutMobileSession,
  normalizeEmail,
  refreshMobileSession,
  registerUser,
  requireMobileUser,
};

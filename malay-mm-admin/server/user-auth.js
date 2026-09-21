const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('./db');

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const OAUTH_HANDOFF_TTL_MS = 2 * 60 * 1000;
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
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    return 'Password must be between 6 and 128 characters.';
  }
  return null;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function passwordResetHash(email, code) {
  const secret = String(process.env.SESSION_SECRET || '');
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be configured before password resets can be used.');
  }
  return crypto.createHmac('sha256', secret).update(`${email}:${code}`).digest('hex');
}

function publicUser(row) {
  return {
    id: row.id,
    ...(row.email ? { email: row.email } : {}),
    ...(row.phone_number ? { phoneNumber: row.phone_number } : {}),
  };
}

async function getProfileCompleted(client, userId) {
  const result = await client.query(
    'SELECT profile_completed FROM profiles WHERE user_id = $1',
    [userId],
  );
  return Boolean(result.rows[0]?.profile_completed);
}

async function loginOrRegisterGoogleUser(identity) {
  const email = normalizeEmail(identity?.email);
  const providerSubject = String(identity?.sub || '').trim();

  if (!validateEmail(email) || !providerSubject) {
    const error = new Error('Verified Google account information is incomplete.');
    error.statusCode = 400;
    throw error;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const identityResult = await client.query(
      `SELECT u.id, u.email
         FROM user_identities i
         JOIN users u ON u.id = i.user_id
        WHERE i.provider = 'google' AND i.provider_subject = $1
        FOR UPDATE OF i`,
      [providerSubject],
    );

    let user = identityResult.rows[0];

    if (!user) {
      const emailResult = await client.query(
        'SELECT id, email, password_hash FROM users WHERE lower(email) = $1 FOR UPDATE',
        [email],
      );
      const existingUser = emailResult.rows[0];

      if (existingUser) {
        if (existingUser.password_hash) {
          const conflict = new Error('An account with this email already exists. Sign in with your Sagawa password first, then link Google from account settings.');
          conflict.statusCode = 409;
          conflict.code = 'google_link_required';
          throw conflict;
        }

        const existingIdentity = await client.query(
          "SELECT provider_subject FROM user_identities WHERE user_id = $1 AND provider = 'google'",
          [existingUser.id],
        );
        if (existingIdentity.rows[0]?.provider_subject && existingIdentity.rows[0].provider_subject !== providerSubject) {
          const conflict = new Error('This email is already linked to a different Google account.');
          conflict.statusCode = 409;
          throw conflict;
        }

        await client.query(
          `INSERT INTO user_identities (user_id, provider, provider_subject, email_at_link)
           VALUES ($1, 'google', $2, $3)
           ON CONFLICT (provider, provider_subject) DO NOTHING`,
          [existingUser.id, providerSubject, email],
        );
        user = existingUser;
      } else {
        const userResult = await client.query(
          `INSERT INTO users (id, email, password_hash)
           VALUES ($1, $2, NULL)
           RETURNING id, email`,
          [crypto.randomUUID(), email],
        );
        user = userResult.rows[0];

        await client.query(
          `INSERT INTO user_identities (user_id, provider, provider_subject, email_at_link)
           VALUES ($1, 'google', $2, $3)`,
          [user.id, providerSubject, email],
        );

        await client.query(
          `INSERT INTO profiles (user_id, name, profile_completed)
           VALUES ($1, $2, false)`,
          [user.id, String(identity?.name || '').trim().slice(0, 120)],
        );
      }
    }

    const profileExists = await client.query('SELECT 1 FROM profiles WHERE user_id = $1', [user.id]);
    if (!profileExists.rows[0]) {
      await client.query(
        `INSERT INTO profiles (user_id, name, profile_completed)
         VALUES ($1, $2, false)`,
        [user.id, String(identity?.name || '').trim().slice(0, 120)],
      );
    }

    const profileCompleted = await getProfileCompleted(client, user.id);
    await client.query('COMMIT');

    return {
      user: publicUser(user),
      profileCompleted,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createOAuthHandoff(userId) {
  const code = createOpaqueToken();
  const expiresAt = new Date(Date.now() + OAUTH_HANDOFF_TTL_MS);
  await db.query('DELETE FROM user_oauth_handoffs WHERE expires_at <= NOW()');
  await db.query(
    `INSERT INTO user_oauth_handoffs (id, user_id, code_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), userId, tokenHash(code), expiresAt],
  );
  return code;
}

async function consumeOAuthHandoff(code) {
  if (typeof code !== 'string' || !code || code.length > 256) return null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `DELETE FROM user_oauth_handoffs
        WHERE code_hash = $1 AND expires_at > NOW()
        RETURNING user_id`,
      [tokenHash(code)],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }

    const userResult = await client.query(
      'SELECT id, email, phone_number FROM users WHERE id = $1',
      [row.user_id],
    );
    const user = userResult.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return null;
    }

    const profileCompleted = await getProfileCompleted(client, user.id);
    const session = await createUserSession(client, user.id);
    await client.query('COMMIT');

    return {
      user: publicUser(user),
      profileCompleted,
      ...session,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createMobileSessionForUser(userId) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT id, email, phone_number FROM users WHERE id = $1',
      [userId],
    );
    const user = userResult.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      return null;
    }

    const profileCompleted = await getProfileCompleted(client, user.id);
    const session = await createUserSession(client, user.id);
    await client.query('COMMIT');

    return {
      user: publicUser(user),
      profileCompleted,
      ...session,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
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

async function registerUser(emailValue, password, ageValue, nameValue) {
  const email = normalizeEmail(emailValue);
  const name = String(nameValue || '').trim().replace(/\s+/g, ' ');
  const ageText = String(ageValue ?? '').trim();
  const age = Number(ageText);
  if (!name || name.length > 100) {
    const error = new Error('Name is required and must be 100 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }
  if (!validateEmail(email)) {
    const error = new Error('Please enter a valid email address.');
    error.statusCode = 400;
    throw error;
  }
  if (!/^\d{1,3}$/.test(ageText) || !Number.isInteger(age) || age < 18 || age > 120) {
    const error = new Error('You must be 18 or older to create a Sagawa account.');
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
      `INSERT INTO profiles (user_id, name, age, profile_completed)
       VALUES ($1, $2, $3, true)`,
      [user.id, name, age],
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

async function createBiometricCredential(userId, platformValue) {
  const token = createOpaqueToken();
  const platform = String(platformValue || 'mobile').trim().toLowerCase().slice(0, 32) || 'mobile';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'DELETE FROM user_biometric_credentials WHERE user_id = $1 AND platform = $2',
      [userId, platform],
    );
    await client.query(
      `INSERT INTO user_biometric_credentials
        (id, user_id, token_hash, platform)
       VALUES ($1, $2, $3, $4)`,
      [crypto.randomUUID(), userId, tokenHash(token), platform],
    );
    await client.query('COMMIT');
    return token;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function loginWithBiometricCredential(token, platformValue) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 512) return null;
  const platform = String(platformValue || 'mobile').trim().toLowerCase().slice(0, 32) || 'mobile';
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT b.id, b.user_id, u.email
         FROM user_biometric_credentials b
         JOIN users u ON u.id = b.user_id
        WHERE b.token_hash = $1 AND b.platform = $2
        FOR UPDATE OF b`,
      [tokenHash(token), platform],
    );
    const row = result.rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      'UPDATE user_biometric_credentials SET last_used_at = NOW() WHERE id = $1',
      [row.id],
    );
    const profileCompleted = await getProfileCompleted(client, row.user_id);
    const session = await createUserSession(client, row.user_id);
    await client.query('COMMIT');
    return {
      user: publicUser({ id: row.user_id, email: row.email }),
      profileCompleted,
      ...session,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function revokeBiometricCredential(userId, platformValue) {
  const platform = String(platformValue || 'mobile').trim().toLowerCase().slice(0, 32) || 'mobile';
  await db.query(
    'DELETE FROM user_biometric_credentials WHERE user_id = $1 AND platform = $2',
    [userId, platform],
  );
}

async function authenticatePasswordUser(identifierValue, password) {
  const rawIdentifier = String(identifierValue || '').trim();
  const email = normalizeEmail(rawIdentifier);
  const compactPhone = rawIdentifier.replace(/[\s().-]/g, '').replace(/^00/, '+');
  const phone = /^01\d{8,9}$/.test(compactPhone)
    ? `+60${compactPhone.slice(1)}`
    : compactPhone;

  let result = { rows: [] };
  if (validateEmail(email)) {
    result = await db.query(
      `SELECT id, email, phone_number, password_hash, email_verified_at, phone_verified_at
         FROM users
        WHERE lower(email) = $1`,
      [email],
    );
  } else if (/^\+601\d{8,9}$/.test(phone)) {
    result = await db.query(
      `SELECT id, email, phone_number, password_hash, email_verified_at, phone_verified_at
         FROM users
        WHERE phone_number = $1`,
      [phone],
    );
  }

  const row = result.rows[0];
  const passwordMatches = await bcrypt.compare(
    typeof password === 'string' ? password : '',
    row?.password_hash || DUMMY_PASSWORD_HASH,
  );
  if (!row || !passwordMatches) return null;

  return {
    id: row.id,
    email: row.email || null,
    phoneNumber: row.phone_number || null,
    emailVerified: Boolean(row.email_verified_at),
    phoneVerified: Boolean(row.phone_verified_at),
  };
}

async function loginUser(identifierValue, password) {
  const rawIdentifier = String(identifierValue || '').trim();
  const email = normalizeEmail(rawIdentifier);
  const compactPhone = rawIdentifier.replace(/[\s().-]/g, '').replace(/^00/, '+');
  const phone = /^01\d{8,9}$/.test(compactPhone)
    ? `+60${compactPhone.slice(1)}`
    : compactPhone;

  let result = { rows: [] };
  if (validateEmail(email)) {
    result = await db.query(
      'SELECT id, email, phone_number, password_hash FROM users WHERE lower(email) = $1',
      [email],
    );
  } else if (/^\+601\d{8,9}$/.test(phone)) {
    result = await db.query(
      'SELECT id, email, phone_number, password_hash FROM users WHERE phone_number = $1',
      [phone],
    );
  }

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

async function requestMobilePasswordReset(emailValue) {
  const email = normalizeEmail(emailValue);
  if (!validateEmail(email)) return null;

  const userResult = await db.query(
    'SELECT id, email FROM users WHERE lower(email) = $1',
    [email],
  );
  const user = userResult.rows[0];
  if (!user) return null;

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  const codeHash = passwordResetHash(email, code);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
  const client = await db.connect();

  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_password_resets WHERE user_id = $1', [user.id]);
    await client.query(
      `INSERT INTO user_password_resets
        (id, user_id, code_hash, expires_at, attempts)
       VALUES ($1, $2, $3, $4, 0)`,
      [crypto.randomUUID(), user.id, codeHash, expiresAt],
    );
    await client.query('COMMIT');
    return { email: user.email, code };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function resetMobilePassword(emailValue, codeValue, password) {
  const email = normalizeEmail(emailValue);
  const code = String(codeValue || '').trim();
  if (!validateEmail(email) || !/^\d{6}$/.test(code)) return false;

  const passwordError = validatePassword(password);
  if (passwordError) {
    const error = new Error(passwordError);
    error.statusCode = 400;
    throw error;
  }

  const candidateHash = passwordResetHash(email, code);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query(
      'SELECT id FROM users WHERE lower(email) = $1 FOR UPDATE',
      [email],
    );
    const user = userResult.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return false;
    }

    const resetResult = await client.query(
      `SELECT id, code_hash, attempts
         FROM user_password_resets
        WHERE user_id = $1 AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE`,
      [user.id],
    );
    const reset = resetResult.rows[0];
    if (!reset || reset.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      await client.query('DELETE FROM user_password_resets WHERE user_id = $1', [user.id]);
      await client.query('COMMIT');
      return false;
    }

    const matches = crypto.timingSafeEqual(
      Buffer.from(reset.code_hash, 'hex'),
      Buffer.from(candidateHash, 'hex'),
    );
    if (!matches) {
      await client.query(
        'UPDATE user_password_resets SET attempts = attempts + 1 WHERE id = $1',
        [reset.id],
      );
      await client.query('COMMIT');
      return false;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await client.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, user.id],
    );
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [user.id]);
    await client.query('DELETE FROM user_password_resets WHERE user_id = $1', [user.id]);
    await client.query('COMMIT');
    return true;
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
    `SELECT s.id AS session_id, s.user_id, s.access_expires_at, u.email, u.phone_number
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
    req.mobileUser = {
      id: session.user_id,
      email: session.email || null,
      phoneNumber: session.phone_number || null,
      sessionId: session.session_id,
    };
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
      `SELECT s.id, s.user_id, u.email, u.phone_number
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
    return { user: publicUser({ id: row.user_id, email: row.email, phone_number: row.phone_number }), ...session };
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
  authenticatePasswordUser,
  consumeOAuthHandoff,
  createBiometricCredential,
  createMobileSessionForUser,
  createOAuthHandoff,
  getMobileSession,
  loginOrRegisterGoogleUser,
  loginUser,
  loginWithBiometricCredential,
  logoutMobileSession,
  normalizeEmail,
  refreshMobileSession,
  registerUser,
  requestMobilePasswordReset,
  resetMobilePassword,
  revokeBiometricCredential,
  requireMobileUser,
};

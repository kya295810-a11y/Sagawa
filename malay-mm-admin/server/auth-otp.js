const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const db = require('./db');
const { sendUserVerificationCode } = require('./email');
const { isSmsConfigured, sendVerificationSms } = require('./sms');
const { createMobileSessionForUser } = require('./user-auth');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const BCRYPT_ROUNDS = 12;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizePhone(value, countryValue) {
  const country = String(countryValue || 'MY').trim().toUpperCase();
  if (country !== 'MY') return null;

  let raw = String(value || '').trim().replace(/[\s().-]/g, '');
  if (raw.startsWith('00')) raw = `+${raw.slice(2)}`;
  if (/^01\d{8,9}$/.test(raw)) raw = `+60${raw.slice(1)}`;
  return /^\+601\d{8,9}$/.test(raw) ? raw : null;
}

function normalizeIdentifier(value, channelValue, country) {
  const channel = String(channelValue || '').trim().toLowerCase();
  if (channel === 'email') {
    const email = normalizeEmail(value);
    return validateEmail(email) ? { channel, identifier: email } : null;
  }
  if (channel === 'phone') {
    const phone = normalizePhone(value, country);
    return phone ? { channel, identifier: phone } : null;
  }
  return null;
}

function verificationHash(challengeId, identifier, code) {
  const secret = String(process.env.SESSION_SECRET || '');
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be configured before account verification can be used.');
  }
  return crypto
    .createHmac('sha256', secret)
    .update(`${challengeId}:${identifier}:${code}`)
    .digest('hex');
}

function makeCode() {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

function identifierHint(channel, identifier) {
  if (channel === 'email') {
    return identifier.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2');
  }
  return identifier.replace(/^(\+\d{2})(\d+)(\d{3})$/, (_m, cc, middle, last) => {
    return `${cc}••••${last}`;
  });
}

async function assertCooldown(purpose, channel, identifier) {
  const result = await db.query(
    `SELECT resend_after
       FROM user_auth_challenges
      WHERE purpose = $1 AND channel = $2 AND identifier = $3
      ORDER BY created_at DESC
      LIMIT 1`,
    [purpose, channel, identifier],
  );
  const resendAfter = result.rows[0]?.resend_after;
  if (resendAfter && new Date(resendAfter).getTime() > Date.now()) {
    const error = new Error('Please wait before requesting another verification code.');
    error.statusCode = 429;
    error.retryAfter = Math.ceil((new Date(resendAfter).getTime() - Date.now()) / 1000);
    throw error;
  }
}

async function deliverCode(channel, identifier, code, purpose) {
  if (channel === 'email') {
    await sendUserVerificationCode(identifier, code, purpose);
    return;
  }
  if (!isSmsConfigured()) {
    const error = new Error('Phone verification is not available yet.');
    error.statusCode = 503;
    throw error;
  }
  await sendVerificationSms(identifier, code);
}

async function createChallenge({ purpose, channel, identifier, payload }) {
  await db.query('DELETE FROM user_auth_challenges WHERE expires_at <= NOW()');
  await assertCooldown(purpose, channel, identifier);

  const id = crypto.randomUUID();
  const code = makeCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const resendAfter = new Date(Date.now() + OTP_RESEND_COOLDOWN_MS);
  const codeHash = verificationHash(id, identifier, code);

  await db.query(
    `INSERT INTO user_auth_challenges
      (id, purpose, channel, identifier, code_hash, payload, attempts, expires_at, resend_after)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,0,$7,$8)`,
    [id, purpose, channel, identifier, codeHash, JSON.stringify(payload || {}), expiresAt, resendAfter],
  );

  try {
    await deliverCode(channel, identifier, code, purpose);
  } catch (error) {
    await db.query('DELETE FROM user_auth_challenges WHERE id = $1', [id]);
    throw error;
  }

  return {
    challengeId: id,
    channel,
    identifierHint: identifierHint(channel, identifier),
    expiresAt: expiresAt.toISOString(),
    resendAfter: resendAfter.toISOString(),
  };
}

async function requestSignupVerification({ nameValue, ageValue, identifierValue, channelValue, country, password }) {
  const normalized = normalizeIdentifier(identifierValue, channelValue, country);
  const name = String(nameValue || '').trim().replace(/\s+/g, ' ');
  const ageText = String(ageValue ?? '').trim();
  const age = Number(ageText);

  if (!name || name.length > 100) {
    const error = new Error('Name is required and must be 100 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }
  if (!/^\d{1,3}$/.test(ageText) || !Number.isInteger(age) || age < 18 || age > 120) {
    const error = new Error('You must be 18 or older to create a Sagawa account.');
    error.statusCode = 400;
    throw error;
  }
  if (!normalized) {
    const error = new Error(
      String(channelValue).toLowerCase() === 'phone'
        ? 'Enter a valid Malaysia (+60) mobile number.'
        : 'Enter a valid email address.',
    );
    error.statusCode = 400;
    throw error;
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    const error = new Error('Password must be between 6 and 128 characters.');
    error.statusCode = 400;
    throw error;
  }

  const existing = normalized.channel === 'email'
    ? await db.query('SELECT 1 FROM users WHERE lower(email) = $1 LIMIT 1', [normalized.identifier])
    : await db.query('SELECT 1 FROM users WHERE phone_number = $1 LIMIT 1', [normalized.identifier]);

  if (existing.rows.length) {
    const error = new Error('An account with this email or phone number already exists.');
    error.statusCode = 409;
    throw error;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return createChallenge({
    purpose: 'signup',
    channel: normalized.channel,
    identifier: normalized.identifier,
    payload: { name, age, passwordHash, country: String(country || '').toUpperCase() },
  });
}

async function requestLoginVerification({ identifierValue, channelValue, country }) {
  const normalized = normalizeIdentifier(identifierValue, channelValue, country);
  if (!normalized) {
    const error = new Error(
      String(channelValue).toLowerCase() === 'phone'
        ? 'Enter a valid Malaysia (+60) mobile number.'
        : 'Enter a valid email address.',
    );
    error.statusCode = 400;
    throw error;
  }

  const result = normalized.channel === 'email'
    ? await db.query(
        'SELECT id, email_verified_at FROM users WHERE lower(email) = $1 LIMIT 1',
        [normalized.identifier],
      )
    : await db.query(
        'SELECT id, phone_verified_at FROM users WHERE phone_number = $1 LIMIT 1',
        [normalized.identifier],
      );
  const user = result.rows[0];

  if (!user) {
    const error = new Error('No Sagawa account was found for that email or phone number.');
    error.statusCode = 404;
    throw error;
  }

  const verified =
    normalized.channel === 'email' ? Boolean(user.email_verified_at) : Boolean(user.phone_verified_at);
  if (!verified) {
    const error = new Error('This account identifier has not been verified yet.');
    error.statusCode = 403;
    throw error;
  }

  return createChallenge({
    purpose: 'login',
    channel: normalized.channel,
    identifier: normalized.identifier,
    payload: { userId: user.id },
  });
}

async function readChallengeForVerification(client, challengeId, code, expectedPurpose) {
  if (!/^[0-9a-f-]{36}$/i.test(String(challengeId || '')) || !/^\d{6}$/.test(String(code || ''))) {
    return { error: 'invalid' };
  }

  const result = await client.query(
    `SELECT id, purpose, channel, identifier, code_hash, payload, attempts, expires_at
       FROM user_auth_challenges
      WHERE id = $1
      FOR UPDATE`,
    [challengeId],
  );
  const challenge = result.rows[0];
  if (!challenge || challenge.purpose !== expectedPurpose) return { error: 'invalid' };

  if (new Date(challenge.expires_at).getTime() <= Date.now()) {
    await client.query('DELETE FROM user_auth_challenges WHERE id = $1', [challenge.id]);
    return { error: 'expired' };
  }

  if (Number(challenge.attempts) >= OTP_MAX_ATTEMPTS) {
    await client.query('DELETE FROM user_auth_challenges WHERE id = $1', [challenge.id]);
    return { error: 'too_many_attempts' };
  }

  const candidate = verificationHash(challenge.id, challenge.identifier, String(code));
  const matches = crypto.timingSafeEqual(
    Buffer.from(challenge.code_hash, 'hex'),
    Buffer.from(candidate, 'hex'),
  );

  if (!matches) {
    await client.query(
      'UPDATE user_auth_challenges SET attempts = attempts + 1 WHERE id = $1',
      [challenge.id],
    );
    return { error: 'invalid' };
  }

  return { challenge };
}

async function verifySignup(challengeId, code) {
  const client = await db.connect();
  let userId = null;

  try {
    await client.query('BEGIN');
    const checked = await readChallengeForVerification(client, challengeId, code, 'signup');
    if (checked.error) {
      await client.query('COMMIT');
      return { error: checked.error };
    }

    const challenge = checked.challenge;
    const payload = challenge.payload || {};
    const userIdValue = crypto.randomUUID();
    const email = challenge.channel === 'email' ? challenge.identifier : null;
    const phone = challenge.channel === 'phone' ? challenge.identifier : null;

    const userResult = await client.query(
      `INSERT INTO users
        (id, email, phone_number, password_hash, email_verified_at, phone_verified_at)
       VALUES ($1,$2,$3,$4,
         CASE WHEN $2::text IS NOT NULL THEN NOW() ELSE NULL END,
         CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE NULL END)
       RETURNING id, email, phone_number`,
      [userIdValue, email, phone, payload.passwordHash],
    );

    await client.query(
      `INSERT INTO profiles (user_id, name, age, profile_completed)
       VALUES ($1,$2,$3,true)`,
      [userIdValue, String(payload.name || '').slice(0, 100), Number(payload.age)],
    );

    await client.query('DELETE FROM user_auth_challenges WHERE id = $1', [challenge.id]);
    await client.query('COMMIT');
    userId = userResult.rows[0].id;
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') {
      const conflict = new Error('An account with this email or phone number already exists.');
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  } finally {
    client.release();
  }

  return createMobileSessionForUser(userId);
}

async function verifyLogin(challengeId, code) {
  const client = await db.connect();
  let userId = null;

  try {
    await client.query('BEGIN');
    const checked = await readChallengeForVerification(client, challengeId, code, 'login');
    if (checked.error) {
      await client.query('COMMIT');
      return { error: checked.error };
    }

    userId = checked.challenge.payload?.userId || null;
    if (!userId) {
      await client.query('DELETE FROM user_auth_challenges WHERE id = $1', [checked.challenge.id]);
      await client.query('COMMIT');
      return { error: 'invalid' };
    }

    await client.query('DELETE FROM user_auth_challenges WHERE id = $1', [checked.challenge.id]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const session = await createMobileSessionForUser(userId);
  return session || { error: 'invalid' };
}

function authCapabilities() {
  return {
    emailVerification: Boolean(
      String(process.env.RESEND_API_KEY || '').trim() && String(process.env.EMAIL_FROM || '').trim(),
    ),
    phoneVerification: isSmsConfigured(),
    phoneCountries: ['MY'],
    codeLength: 6,
  };
}

module.exports = {
  authCapabilities,
  normalizeIdentifier,
  normalizePhone,
  requestLoginVerification,
  requestSignupVerification,
  verifyLogin,
  verifySignup,
};

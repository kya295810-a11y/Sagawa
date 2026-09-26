const crypto = require('crypto');

const db = require('./db');
const { sendUserVerificationCode } = require('./email');
const { isSmsConfigured, sendVerificationSms } = require('./sms');
const { createMobileSessionForUser } = require('./user-auth');

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

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
    const email = String(identifier || '').trim().toLowerCase();
    const atIndex = email.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === email.length - 1) return email;

    const name = email.slice(0, atIndex);
    const domain = email.slice(atIndex + 1);

    if (name.length <= 3) return `${name}***@${domain}`;
    if (name.length <= 5) return `${name.slice(0, 3)}***@${domain}`;
    return `${name.slice(0, 3)}***${name.slice(-2)}@${domain}`;
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

async function createChallenge({ purpose, channel, identifier, payload, reuseActive = false }) {
  await db.query('DELETE FROM user_auth_challenges WHERE expires_at <= NOW()');

  if (reuseActive) {
    const activeResult = await db.query(
      `SELECT id, channel, identifier, payload, attempts, expires_at, resend_after
         FROM user_auth_challenges
        WHERE purpose = $1
          AND channel = $2
          AND identifier = $3
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [purpose, channel, identifier],
    );
    const active = activeResult.rows[0];
    const sameUser =
      String(active?.payload?.userId || '') === String(payload?.userId || '');

    if (active && sameUser && Number(active.attempts) < OTP_MAX_ATTEMPTS) {
      return {
        challengeId: active.id,
        channel: active.channel,
        identifierHint: identifierHint(active.channel, active.identifier),
        expiresAt: new Date(active.expires_at).toISOString(),
        resendAfter: new Date(active.resend_after).toISOString(),
        reused: true,
      };
    }
  }

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
    reused: false,
  };
}

async function requestSignupVerification({
  nameValue,
  dateOfBirthValue,
  identifierValue,
  channelValue,
  country,
  stateValue,
  cityValue,
}) {
  const countryCode = String(country || '').trim().toUpperCase();
  const normalized = normalizeIdentifier(identifierValue, channelValue, countryCode);
  const name = String(nameValue || '').trim().replace(/\s+/g, ' ');
  const dateOfBirth = String(dateOfBirthValue || '').trim();
  const state = String(stateValue || '').trim().replace(/\s+/g, ' ');
  const city = String(cityValue || '').trim().replace(/\s+/g, ' ');

  if (!name || name.length > 100) {
    const error = new Error('Name is required and must be 100 characters or fewer.');
    error.statusCode = 400;
    throw error;
  }
  if (!['MY', 'SG', 'TH'].includes(countryCode)) {
    const error = new Error('Choose Malaysia, Singapore, or Thailand.');
    error.statusCode = 400;
    throw error;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    const error = new Error('Choose a valid date of birth.');
    error.statusCode = 400;
    throw error;
  }
  const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime())) {
    const error = new Error('Choose a valid date of birth.');
    error.statusCode = 400;
    throw error;
  }
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  if (age < 18 || age > 120) {
    const error = new Error('You must be 18 or older to create a Sagawa account.');
    error.statusCode = 400;
    throw error;
  }
  if (!state || state.length > 100 || !city || city.length > 100) {
    const error = new Error('State/Province and city are required.');
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

  const existing = normalized.channel === 'email'
    ? await db.query('SELECT 1 FROM users WHERE lower(email) = $1 LIMIT 1', [normalized.identifier])
    : await db.query('SELECT 1 FROM users WHERE phone_number = $1 LIMIT 1', [normalized.identifier]);

  if (existing.rows.length) {
    const error = new Error('An account with this email or phone number already exists.');
    error.statusCode = 409;
    throw error;
  }

  return createChallenge({
    purpose: 'signup',
    channel: normalized.channel,
    identifier: normalized.identifier,
    payload: { name, age, dateOfBirth, countryCode, state, city },
  });
}

async function requestPasswordLoginVerification(user, preferredChannel) {
  const email = String(user?.email || '').trim().toLowerCase();
  const phone = String(user?.phoneNumber || '').trim();
  const channel = preferredChannel === 'phone' ? 'phone' : 'email';

  // Legacy accounts may predate verified_at columns. Sending the code to the
  // stored contact and requiring the code proves ownership during this login.
  if (channel === 'email' && email) {
    return createChallenge({
      purpose: 'login',
      channel: 'email',
      identifier: email,
      payload: { userId: user.id, verifyContactOnSuccess: true },
      reuseActive: true,
    });
  }

  if (channel === 'phone' && phone) {
    return createChallenge({
      purpose: 'login',
      channel: 'phone',
      identifier: phone,
      payload: { userId: user.id, verifyContactOnSuccess: true },
      reuseActive: true,
    });
  }

  const error = new Error('That verification method is not available for this account.');
  error.statusCode = 400;
  throw error;
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
  try {
    await client.query('BEGIN');
    const checked = await readChallengeForVerification(client, challengeId, code, 'signup');
    if (checked.error) {
      await client.query('COMMIT');
      return { error: checked.error };
    }

    const challenge = checked.challenge;
    const verifiedToken = crypto.randomBytes(32).toString('base64url');
    const verifiedTokenHash = crypto.createHash('sha256').update(verifiedToken).digest('hex');
    const payload = {
      ...(challenge.payload || {}),
      verified: true,
      verifiedTokenHash,
      verifiedAt: new Date().toISOString(),
    };

    await client.query(
      `UPDATE user_auth_challenges
          SET purpose = 'signup_verified',
              payload = $2::jsonb,
              attempts = 0,
              expires_at = LEAST(expires_at, NOW() + INTERVAL '10 minutes')
        WHERE id = $1`,
      [challenge.id, JSON.stringify(payload)],
    );
    await client.query('COMMIT');
    return {
      signupTicket: `${challenge.id}.${verifiedToken}`,
      expiresAt: new Date(Math.min(new Date(challenge.expires_at).getTime(), Date.now() + OTP_TTL_MS)).toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function completeVerifiedSignup(signupTicket, password, confirmPassword) {
  const [challengeId, verifiedToken] = String(signupTicket || '').trim().split('.');
  if (!/^[0-9a-f-]{36}$/i.test(challengeId || '') || !verifiedToken) {
    const error = new Error('Verification expired. Verify your email or phone again.');
    error.statusCode = 401;
    throw error;
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 128) {
    const error = new Error('Password must be between 6 and 128 characters.');
    error.statusCode = 400;
    throw error;
  }
  if (password !== confirmPassword) {
    const error = new Error('Passwords do not match.');
    error.statusCode = 400;
    throw error;
  }

  const bcrypt = require('bcryptjs');
  const passwordHash = await bcrypt.hash(password, 12);
  const tokenHash = crypto.createHash('sha256').update(verifiedToken).digest('hex');
  const client = await db.connect();
  let userId = null;

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `SELECT id, channel, identifier, payload, expires_at
         FROM user_auth_challenges
        WHERE id = $1 AND purpose = 'signup_verified'
        FOR UPDATE`,
      [challengeId],
    );
    const challenge = result.rows[0];
    if (
      !challenge ||
      new Date(challenge.expires_at).getTime() <= Date.now() ||
      challenge.payload?.verifiedTokenHash !== tokenHash ||
      challenge.payload?.verified !== true
    ) {
      await client.query('ROLLBACK');
      const error = new Error('Verification expired. Verify your email or phone again.');
      error.statusCode = 401;
      throw error;
    }

    const payload = challenge.payload || {};
    const email = challenge.channel === 'email' ? challenge.identifier : null;
    const phone = challenge.channel === 'phone' ? challenge.identifier : null;
    userId = crypto.randomUUID();

    await client.query(
      `INSERT INTO users
        (id, email, phone_number, password_hash, email_verified_at, phone_verified_at)
       VALUES ($1,$2,$3,$4,
         CASE WHEN $2::text IS NOT NULL THEN NOW() ELSE NULL END,
         CASE WHEN $3::text IS NOT NULL THEN NOW() ELSE NULL END)`,
      [userId, email, phone, passwordHash],
    );
    await client.query(
      `INSERT INTO profiles
        (user_id, name, age, date_of_birth, country_code, state, city, location, profile_completed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)`,
      [
        userId,
        String(payload.name || '').slice(0, 100),
        Number(payload.age),
        payload.dateOfBirth,
        payload.countryCode,
        String(payload.state || '').slice(0, 100),
        String(payload.city || '').slice(0, 100),
        [payload.city, payload.state, payload.countryCode].filter(Boolean).join(', '),
      ],
    );
    await client.query('DELETE FROM user_auth_challenges WHERE id = $1', [challenge.id]);
    await client.query('COMMIT');
  } catch (error) {
    if (!error.statusCode) await client.query('ROLLBACK').catch(() => {});
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

    if (checked.challenge.payload?.verifyContactOnSuccess) {
      if (checked.challenge.channel === 'email') {
        await client.query(
          'UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = $1',
          [userId],
        );
      } else if (checked.challenge.channel === 'phone') {
        await client.query(
          'UPDATE users SET phone_verified_at = COALESCE(phone_verified_at, NOW()) WHERE id = $1',
          [userId],
        );
      }
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
  requestPasswordLoginVerification,
  requestSignupVerification,
  completeVerifiedSignup,
  verifyLogin,
  verifySignup,
};

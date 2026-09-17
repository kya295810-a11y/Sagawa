// server.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const db = require('./db');
const {
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_ORIGIN,
  VERIFICATION_CODE_COOKIE_NAME,
  beginAuthentication,
  beginRegistration,
  clearSessionCookie,
  createSession,
  createVerificationState,
  hasVerificationState,
  createPasswordResetState,
  validateResetCode,
  destroyAllSessions,
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
} = require('./auth');
const {
  getMobileSession,
  loginUser,
  logoutMobileSession,
  normalizeEmail,
  refreshMobileSession,
  registerUser,
  requestMobilePasswordReset,
  resetMobilePassword,
  requireMobileUser,
} = require('./user-auth');
const { isEmailConfigured, sendVerificationCode, sendPasswordResetCode } = require('./email');

const app = express();

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 0);
if (Number.isInteger(trustProxyHops) && trustProxyHops > 0) {
  app.set('trust proxy', trustProxyHops);
}

function boundedText(value, maxLength, fieldName) {
  const text = String(value ?? '').trim();
  if (text.length > maxLength) {
    const error = new Error(`${fieldName} must be ${maxLength} characters or fewer.`);
    error.statusCode = 400;
    throw error;
  }
  return text;
}

const profileUploadDir = path.join(__dirname, 'uploads', 'profile');
fs.mkdirSync(profileUploadDir, { recursive: true });

const profileExtensionByMime = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const profileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, profileUploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = profileExtensionByMime[file.mimetype];
    cb(null, `profile-${crypto.randomUUID()}${ext}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(path.basename(file.originalname || '')).toLowerCase();
    const allowedExtensions =
      file.mimetype === 'image/jpeg' ? ['.jpg', '.jpeg'] : [profileExtensionByMime[file.mimetype]];
    if (!profileExtensionByMime[file.mimetype] || !allowedExtensions.includes(extension)) {
      return cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
    cb(null, true);
  },
});

const profileUploadMiddleware = (req, res, next) => {
  profileUpload.single('image')(req, res, (error) => {
    if (!error) {
      if (!req.file) return next();

      try {
        const header = Buffer.alloc(12);
        const descriptor = fs.openSync(req.file.path, 'r');
        fs.readSync(descriptor, header, 0, header.length, 0);
        fs.closeSync(descriptor);
        const isJpeg = header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
        const isPng = header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
        const isWebp = header.subarray(0, 4).toString('ascii') === 'RIFF' && header.subarray(8, 12).toString('ascii') === 'WEBP';
        const validForMime =
          (req.file.mimetype === 'image/jpeg' && isJpeg) ||
          (req.file.mimetype === 'image/png' && isPng) ||
          (req.file.mimetype === 'image/webp' && isWebp);

        if (validForMime) return next();
        fs.unlinkSync(req.file.path);
        return res.status(422).json({ success: false, message: 'Uploaded file is not a valid image.' });
      } catch (validationError) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Best-effort cleanup.
        }
        return next(validationError);
      }
    }

    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 422;
    return res.status(status).json({
      success: false,
      message:
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Profile image must be 5 MB or smaller.'
          : error.message || 'Invalid profile image.',
    });
  });
};

const PORT = Number(process.env.API_PORT || process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = configuredCorsOrigins.length ? configuredCorsOrigins : [ADMIN_ORIGIN];

if (!allowedCorsOrigins.length || !allowedCorsOrigins.every(Boolean)) {
  throw new Error(
    'CORS_ORIGIN or ADMIN_ORIGIN must be set to a trusted browser origin before starting the server.',
  );
}

const corsOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  origin(origin, callback) {
    if (!origin || allowedCorsOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.error('[CORS] Rejected origin:', origin);
    return callback(null, false);
  },
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 250,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Try again later.',
  },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Try again later.',
  },
});

const resendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many code requests. Try again later.' },
});

app.use(cors(corsOptions));
app.options('/{*splat}', cors(corsOptions));
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/api', (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin || allowedCorsOrigins.includes(origin)) return next();
  return res.status(403).json({ success: false, message: 'Origin is not allowed.' });
});
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});

app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('[Health] Database check failed:', error.message);
    return res.status(503).json({ status: 'unavailable' });
  }
});

app.use(['/api/news', '/api/services'], express.json({ limit: '32mb' }));
app.use(express.json({ limit: '256kb' }));
app.use('/uploads/content', express.static(path.join(__dirname, 'uploads', 'content'), {
  index: false,
  dotfiles: 'deny',
  setHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));
app.use(
  express.urlencoded({
    extended: true,
    limit: '64kb',
  }),
);

app.post('/api/auth/register', async (req, res) => {
  try {
    const result = await registerUser(req.body?.email, req.body?.password);
    return res.status(201).json({
      success: true,
      data: { ...result, profileCompleted: false },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Mobile registration failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to create account.' : error.message,
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = req.body?.password;
  const isMobileRequest = req.body?.accountType === 'mobile';

  if (!email || typeof password !== 'string' || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required.',
    });
  }

  try {
    if (isMobileRequest || normalizeEmail(email) !== ADMIN_EMAIL) {
      const mobileSession = await loginUser(email, password);
      if (!mobileSession) {
        return res.status(401).json({ success: false, message: 'Invalid email or password.' });
      }
      const profileResult = await db.query(
        'SELECT profile_completed FROM profiles WHERE user_id = $1',
        [mobileSession.user.id],
      );
      return res.json({
        success: true,
        data: {
          ...mobileSession,
          authenticated: true,
          profileCompleted: Boolean(profileResult.rows[0]?.profile_completed),
        },
      });
    }

    if (!(await login(email, password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = {
      name: ADMIN_NAME || 'Admin',
      email: ADMIN_EMAIL,
    };

    const sessionToken = createSession();
    setSessionCookie(res, sessionToken);

    console.log('[Auth] Admin login succeeded.');

    return res.json({
      success: true,
      data: {
        authenticated: true,
        user,
      },
    });
  } catch (error) {
    console.error('[Auth] Login failed:', error.message);

    return res.status(500).json({
      success: false,
      message: 'Authentication service unavailable.',
    });
  }
});

app.post('/api/auth/refresh', async (req, res) => {
  try {
    const session = await refreshMobileSession(req.body?.refreshToken);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Session expired.' });
    }
    const profileResult = await db.query(
      'SELECT profile_completed FROM profiles WHERE user_id = $1',
      [session.user.id],
    );
    return res.json({
      success: true,
      data: { ...session, profileCompleted: Boolean(profileResult.rows[0]?.profile_completed) },
    });
  } catch (error) {
    console.error('[Auth] Mobile session refresh failed:', error.message);
    return res.status(500).json({ success: false, message: 'Authentication service unavailable.' });
  }
});

app.post('/api/auth/resend-code', resendLimiter, async (req, res) => {
  // Get the verification state ID from the cookie
  const cookies = {};
  for (const cookie of String(req.headers.cookie || '').split(';')) {
    const trimmed = cookie.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const name = trimmed.slice(0, index).trim();
    const encodedValue = trimmed.slice(index + 1).trim();
    if (!name || !encodedValue) continue;
    try {
      cookies[name] = decodeURIComponent(encodedValue);
    } catch {
      continue;
    }
  }

  const stateId = cookies[VERIFICATION_CODE_COOKIE_NAME];
  if (!stateId) {
    console.error('[Auth] Resend code failed: no verification state found.');
    return res
      .status(401)
      .json({ success: false, message: 'Invalid verification state. Please sign in again.' });
  }

  if (!hasVerificationState(stateId)) {
    return res.status(401).json({ success: false, message: 'Invalid verification state. Please sign in again.' });
  }

  try {
    // Generate a new verification state (invalidates the old one)
    const { stateId: newStateId, code } = createVerificationState();

    try {
      const email = process.env.ADMIN_EMAIL;
      await sendVerificationCode(email, code);
      console.log('[Auth] Verification code resent to configured admin email.');

      // Set the new verification state ID in a cookie
      const secureFlag =
        ADMIN_ORIGIN.startsWith('https://') || process.env.NODE_ENV === 'production'
          ? '; Secure'
          : '';
      res.setHeader(
        'Set-Cookie',
        `${VERIFICATION_CODE_COOKIE_NAME}=${encodeURIComponent(newStateId)}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax${secureFlag}`,
      );

      return res.json({ success: true, data: { codeSent: true } });
    } catch (emailError) {
      console.error('[Auth] Failed to resend verification code:', emailError.message);
      return res
        .status(500)
        .json({ success: false, message: 'Unable to resend verification code. Please try again.' });
    }
  } catch (error) {
    console.error('[Auth] Resend code failed:', error.message);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to resend code. Please try again.' });
  }
});

app.get('/api/auth/me', async (req, res) => {
  try {
    const mobileSession = await getMobileSession(req);
    if (mobileSession) {
      const profileResult = await db.query(
        'SELECT profile_completed FROM profiles WHERE user_id = $1',
        [mobileSession.user_id],
      );
      return res.json({
        success: true,
        data: {
          authenticated: true,
          profileCompleted: Boolean(profileResult.rows[0]?.profile_completed),
          user: { id: mobileSession.user_id, email: mobileSession.email },
        },
      });
    }
  } catch (error) {
    console.error('[Auth] Mobile session check failed:', error.message);
    return res.status(500).json({ success: false, message: 'Authentication service unavailable.' });
  }
  const user = getAuthenticatedUser(req);
  const authenticated = isAdminAuthenticated(req);
  return res.json({
    success: true,
    data: {
      authenticated,
      user: authenticated ? user : null,
    },
  });
});

app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  const currentPassword =
    typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword =
    typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res
      .status(400)
      .json({
        success: false,
        message: 'Current password, new password, and confirmation are required.',
      });
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    return res.status(400).json({ success: false, message: policyError });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'New passwords do not match.' });
  }

  try {
    if (!(await verifyPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    const nextHash = await bcrypt.hash(newPassword, 12);
    replaceAdminPasswordHash(nextHash);
    destroyAllSessions();
    clearSessionCookie(res);

    return res.json({
      success: true,
      message: 'Password updated successfully. Please sign in again.',
    });
  } catch (error) {
    console.error('[Auth] Change password failed:', error.message);
    return res.status(500).json({ success: false, message: 'Password change failed.' });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    await logoutMobileSession(req);
    destroySession(req);
    clearSessionCookie(res);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Logout failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to sign out.' });
  }
});

app.post('/api/auth/forgot-password', resendLimiter, async (req, res) => {
  const email = String(req.body?.email || '')
    .trim()
    .toLowerCase();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isMobileRequest = req.body?.accountType === 'mobile';

  if (!email || !emailPattern.test(email)) {
    return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
  }

  try {
    if (!isMobileRequest && email === process.env.ADMIN_EMAIL?.trim().toLowerCase()) {
      const { stateId, code } = createPasswordResetState();

      try {
        await sendPasswordResetCode(email, code, { admin: true });
        console.log('[Auth] Password reset code sent to configured admin email.');

        // Set the reset state ID in a cookie
        const secureFlag =
          ADMIN_ORIGIN.startsWith('https://') || process.env.NODE_ENV === 'production'
            ? '; Secure'
            : '';
        res.setHeader(
          'Set-Cookie',
          `${VERIFICATION_CODE_COOKIE_NAME}=${encodeURIComponent(stateId)}; Max-Age=600; Path=/; HttpOnly; SameSite=Lax${secureFlag}`,
        );

        return res.json({ success: true, data: { resetCodeSent: true } });
      } catch (emailError) {
        console.error('[Auth] Failed to send password reset code:', emailError.message);
        // Even if email fails, return generic success to prevent enumeration
        return res.json({ success: true, data: { resetCodeSent: true } });
      }
    }

    const reset = await requestMobilePasswordReset(email);
    if (reset) {
      try {
        await sendPasswordResetCode(reset.email, reset.code);
        console.log('[Auth] Mobile password reset code sent.');
      } catch (emailError) {
        console.error('[Auth] Failed to send mobile password reset code:', emailError.message);
      }
    }

    // Always use the same response so callers cannot discover registered accounts.
    return res.json({ success: true, data: { resetCodeSent: true } });
  } catch (error) {
    console.error('[Auth] Forgot password failed:', error.message);
    return res.json({ success: true, data: { resetCodeSent: true } });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const resetCode = String(req.body?.code || '').trim();
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword =
    typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!resetCode || !newPassword || !confirmPassword) {
    return res
      .status(400)
      .json({ success: false, message: 'Reset code and new password are required.' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ success: false, message: 'New passwords do not match.' });
  }

  if (email) {
    try {
      const passwordReset = await resetMobilePassword(email, resetCode, newPassword);
      if (!passwordReset) {
        return res.status(401).json({ success: false, message: 'Invalid or expired reset code.' });
      }
      console.log('[Auth] Mobile password reset successfully; existing sessions revoked.');
      return res.json({
        success: true,
        data: { passwordReset: true },
        message: 'Password reset successfully. Please sign in with your new password.',
      });
    } catch (error) {
      const status = Number(error.statusCode) || 500;
      if (status >= 500) console.error('[Auth] Mobile password reset failed:', error.message);
      return res.status(status).json({
        success: false,
        message: status >= 500 ? 'Password reset failed. Please try again.' : error.message,
      });
    }
  }

  const policyError = validatePasswordPolicy(newPassword);
  if (policyError) {
    return res.status(400).json({ success: false, message: policyError });
  }

  // Get the reset state ID from the cookie
  const cookies = {};
  for (const cookie of String(req.headers.cookie || '').split(';')) {
    const trimmed = cookie.trim();
    if (!trimmed) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const name = trimmed.slice(0, index).trim();
    const encodedValue = trimmed.slice(index + 1).trim();
    if (!name || !encodedValue) continue;
    try {
      cookies[name] = decodeURIComponent(encodedValue);
    } catch {
      continue;
    }
  }

  const stateId = cookies[VERIFICATION_CODE_COOKIE_NAME];
  if (!stateId) {
    console.error('[Auth] Reset password failed: no reset state found.');
    return res
      .status(401)
      .json({
        success: false,
        message: 'Invalid reset state. Please request a new password reset.',
      });
  }

  try {
    const validation = validateResetCode(stateId, resetCode);
    if (!validation.valid) {
      console.error('[Auth] Reset password validation failed:', validation.reason);
      return res.status(401).json({ success: false, message: 'Invalid or expired reset code.' });
    }

    // Reset code is valid. Update the password.
    const nextHash = await bcrypt.hash(newPassword, 12);
    replaceAdminPasswordHash(nextHash);

    // Invalidate all existing sessions
    destroyAllSessions();

    // Clear cookies
    clearSessionCookie(res);
    const secureFlag =
      ADMIN_ORIGIN.startsWith('https://') || process.env.NODE_ENV === 'production'
        ? '; Secure'
        : '';
    res.append(
      'Set-Cookie',
      `${VERIFICATION_CODE_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secureFlag}`,
    );

    console.log('[Auth] Password reset successfully. Admin must sign in again.');
    return res.json({
      success: true,
      data: { passwordReset: true },
      message: 'Password reset successfully. Please sign in with your new password.',
    });
  } catch (error) {
    console.error('[Auth] Reset password failed:', error.message);
    return res
      .status(500)
      .json({ success: false, message: 'Password reset failed. Please try again.' });
  }
});

app.post('/api/auth/passkey/authentication-options', (req, res) => {
  try {
    return res.json({ success: true, data: beginAuthentication() });
  } catch (error) {
    console.error('[Auth] Passkey options failed:', error.message);
    return res
      .status(400)
      .json({ success: false, message: 'Passkey authentication is unavailable.' });
  }
});

app.post('/api/auth/passkey/authentication', async (req, res) => {
  try {
    await finishAuthentication(req.body);
    setSessionCookie(res, createSession());
    console.log('[Auth] Passkey login succeeded.');
    return res.json({
      success: true,
      data: {
        authenticated: true,
        user: {
          name: ADMIN_NAME || 'Admin',
          email: ADMIN_EMAIL,
        },
      },
    });
  } catch (error) {
    console.error('[Auth] Passkey login failed:', error.message);
    return res.status(401).json({ success: false, message: 'Passkey authentication failed.' });
  }
});

app.post('/api/auth/passkey/registration-options', requireAdmin, (req, res) => {
  try {
    return res.json({ success: true, data: beginRegistration(req) });
  } catch (error) {
    console.error('[Auth] Passkey registration options failed:', error.message);
    return res
      .status(400)
      .json({ success: false, message: 'Passkey registration is unavailable.' });
  }
});

app.post('/api/auth/passkey/registration', requireAdmin, async (req, res) => {
  try {
    await finishRegistration(req, req.body);
    console.log('[Auth] Passkey registration succeeded.');
    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Passkey registration failed:', error.message);
    return res.status(400).json({ success: false, message: 'Passkey registration failed.' });
  }
});

// Public GETs are consumed by the mobile app. All admin mutations require a session.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/auth/me') return next();
  if (req.path === '/profile' || req.path.startsWith('/profile/')) return next();
  if (req.method === 'GET') return next();
  return requireAdmin(req, res, next);
});

const dataDir = path.join(__dirname, 'data');

const newsFile = path.join(dataDir, 'news.json');

const profileFile = path.join(dataDir, 'profile.json');

const supportFile = path.join(dataDir, 'support.json');

const notificationTokensFile = path.join(dataDir, 'notification-tokens.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true,
  });
}

function createFileIfMissing(file, defaultValue) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), 'utf8');
  }
}

function readJson(file, fallback) {
  try {
    const content = fs.readFileSync(file, 'utf8');

    if (!content.trim()) {
      return fallback;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to read ${file}:`, error.message);

    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

createFileIfMissing(newsFile, []);

createFileIfMissing(profileFile, {
  name: 'Your Profile',
  phoneNumber: '',
  address: '',
  profileImage: '',
  updatedAt: new Date().toISOString(),
});

createFileIfMissing(supportFile, []);

createFileIfMissing(notificationTokensFile, []);

function readProfile() {
  const profile = readJson(profileFile, null);

  if (profile && typeof profile === 'object') {
    return {
      name: String(profile.name || 'Your Profile').trim(),
      phoneNumber: String(profile.phoneNumber || '').trim(),
      address: String(profile.address || '').trim(),
      profileImage: String(profile.profileImage || '').trim(),
      updatedAt: profile.updatedAt || new Date().toISOString(),
    };
  }

  const fallback = {
    name: 'Your Profile',
    phoneNumber: '',
    address: '',
    profileImage: '',
    updatedAt: new Date().toISOString(),
  };

  writeJson(profileFile, fallback);

  return fallback;
}

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sagawa Local API is running',
    endpoints: {
      news: '/api/news',
      services: '/api/services',
      exchange: '/api/exchange',
      exchangeRate: '/api/exchange-rate',
      profile: '/api/profile',
      support: '/api/support',
    },
  });
});
app.get('/api/news', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id,
        title,
        description,
        image_name AS image,
        video_url AS video,
        published,
        date
      FROM news
      ${isAdminAuthenticated(req) ? '' : 'WHERE published = TRUE'}
      ORDER BY created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[News] GET failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load news.',
    });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT
        id,
        title,
        description,
        image_name AS image,
        video_url AS video,
        published,
        date
       FROM news
       WHERE id = $1
         ${isAdminAuthenticated(req) ? '' : 'AND published = TRUE'}`,
      [String(req.params.id)],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found.',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[News] GET by id failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load news.',
    });
  }
});

app.post('/api/news', async (req, res) => {
  try {
    const { title, description = '', image = '', video = '', published = true } = req.body || {};

    const cleanTitle = boundedText(title, 160, 'Title');
    const cleanDescription = boundedText(description, 10000, 'Description');
    const cleanImage = boundedText(image, 8 * 1024 * 1024, 'Image');
    const cleanVideo = boundedText(video, 17 * 1024 * 1024, 'Video');

    if (!cleanTitle) {
      return res.status(400).json({
        success: false,
        message: 'Title is required.',
      });
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM news');
    if (countResult.rows[0].count >= 10) {
      return res.status(409).json({ success: false, message: 'A maximum of 10 news items is allowed.' });
    }

    const id = Date.now().toString();

    const result = await db.query(
      `INSERT INTO news
        (id, title, description, image_name, video_url, published, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         title,
         description,
         image_name AS image,
         video_url AS video,
         published,
         date`,
      [
        id,
        cleanTitle,
        cleanDescription,
        cleanImage,
        cleanVideo,
        Boolean(published),
        new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      ],
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[News] POST failed:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to create news.',
    });
  }
});

app.put('/api/news/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};

    if (body.title !== undefined) {
      body.title = boundedText(body.title, 160, 'Title');
      if (!body.title) return res.status(400).json({ success: false, message: 'Title is required.' });
    }
    if (body.description !== undefined) body.description = boundedText(body.description, 10000, 'Description');
    if (body.image !== undefined) body.image = boundedText(body.image, 8 * 1024 * 1024, 'Image');
    if (body.video !== undefined) body.video = boundedText(body.video, 17 * 1024 * 1024, 'Video');

    const existing = await db.query('SELECT * FROM news WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found.',
      });
    }

    const current = existing.rows[0];

    const result = await db.query(
      `UPDATE news
       SET title = $1,
           description = $2,
           image_name = $3,
           video_url = $4,
           published = $5,
           date = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING
         id,
         title,
         description,
         image_name AS image,
         video_url AS video,
         published,
         date`,
      [
        body.title ?? current.title,
        body.description ?? current.description,
        body.image ?? current.image_name,
        body.video ?? current.video_url,
        body.published ?? current.published,
        body.date ?? current.date,
        id,
      ],
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[News] PUT failed:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update news.',
    });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM news WHERE id = $1 RETURNING id', [
      String(req.params.id),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found.',
      });
    }

    res.json({
      success: true,
      message: 'News deleted successfully.',
    });
  } catch (error) {
    console.error('[News] DELETE failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete news.',
    });
  }
});

app.get('/api/services', async (req, res) => {
  try {
    const result = await db.query(`
        SELECT
          id,
          title,
          description,
          icon,
          details,
          contact,
          location,
          opening_hours AS "openingHours",
          website,
          published,
          date,
          image_name AS "imageName",
          image_name AS image,
          phone,
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM services
        ${isAdminAuthenticated(req) ? '' : 'WHERE published = TRUE'}
        ORDER BY created_at DESC
      `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[Services] GET failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load services.',
    });
  }
});

app.post('/api/services', async (req, res) => {
  try {
    const body = req.body || {};

    const title = boundedText(body.title, 160, 'Service title');

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Service title is required.',
      });
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM services');
    if (countResult.rows[0].count >= 25) {
      return res.status(409).json({ success: false, message: 'A maximum of 25 services is allowed.' });
    }

    const id = String(body.id || Date.now());

    const result = await db.query(
      `INSERT INTO services
          (id, title, description, icon, details, contact, location,
           opening_hours, website, published, date, image_name, phone)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING
          id, title, description, icon, details, contact, location,
          opening_hours AS "openingHours",
          website, published, date,
          image_name AS "imageName",
          phone,
          created_at AS "createdAt",
          updated_at AS "updatedAt"`,
      [
        id,
        title,
        boundedText(body.description, 10000, 'Description'),
        boundedText(body.icon || 'grid-outline', 80, 'Icon'),
        boundedText(body.details, 10000, 'Details'),
        boundedText(body.contact, 200, 'Contact'),
        boundedText(body.location, 500, 'Location'),
        boundedText(body.openingHours, 500, 'Opening hours'),
        boundedText(body.website, 2048, 'Website'),
        body.published !== undefined ? Boolean(body.published) : true,
        body.date ||
          new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
        boundedText(body.image || body.imageName, 8 * 1024 * 1024, 'Image'),
        boundedText(body.phone, 80, 'Phone'),
      ],
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Services] POST failed:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to create service.',
    });
  }
});

app.put('/api/services/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};

    const serviceFieldLimits = {
      title: 160,
      description: 10000,
      icon: 80,
      details: 10000,
      contact: 200,
      location: 500,
      openingHours: 500,
      website: 2048,
      image: 8 * 1024 * 1024,
      imageName: 8 * 1024 * 1024,
      phone: 80,
      date: 80,
    };
    for (const [field, limit] of Object.entries(serviceFieldLimits)) {
      if (body[field] !== undefined) body[field] = boundedText(body[field], limit, field);
    }
    if (body.title !== undefined && !body.title) {
      return res.status(400).json({ success: false, message: 'Service title is required.' });
    }

    const result = await db.query(
      `UPDATE services
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             icon = COALESCE($3, icon),
             details = COALESCE($4, details),
             contact = COALESCE($5, contact),
             location = COALESCE($6, location),
             opening_hours = COALESCE($7, opening_hours),
             website = COALESCE($8, website),
             published = COALESCE($9, published),
             date = COALESCE($10, date),
             image_name = COALESCE($11, image_name),
             phone = COALESCE($12, phone),
             updated_at = NOW()
         WHERE id = $13
         RETURNING
           id, title, description, icon, details, contact, location,
           opening_hours AS "openingHours",
           website, published, date,
           image_name AS "imageName",
           image_name AS image,
           phone,
           created_at AS "createdAt",
           updated_at AS "updatedAt"`,
      [
        body.title !== undefined ? String(body.title).trim() : null,
        body.description !== undefined ? String(body.description) : null,
        body.icon !== undefined ? String(body.icon) : null,
        body.details !== undefined ? String(body.details) : null,
        body.contact !== undefined ? String(body.contact) : null,
        body.location !== undefined ? String(body.location) : null,
        body.openingHours !== undefined ? String(body.openingHours) : null,
        body.website !== undefined ? String(body.website) : null,
        body.published !== undefined ? Boolean(body.published) : null,
        body.date !== undefined ? String(body.date) : null,
        body.image !== undefined
          ? String(body.image)
          : body.imageName !== undefined
            ? String(body.imageName)
            : null,
        body.phone !== undefined ? String(body.phone) : null,
        id,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Services] PUT failed:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update service.',
    });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM services
         WHERE id = $1
         RETURNING id`,
      [String(req.params.id)],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    res.json({
      success: true,
      message: 'Service deleted successfully.',
    });
  } catch (error) {
    console.error('[Services] DELETE failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to delete service.',
    });
  }
});

async function getExchangeRate() {
  const result = await db.query(`
    SELECT
      id,
      rate,
      updated_at AS "updatedAt"
    FROM exchange_rates
    ORDER BY updated_at DESC, id DESC
    LIMIT 1
  `);

  return result.rows[0] || null;
}

async function saveExchangeRate(req, res) {
  try {
    const body = req.body || {};
    const rate = String(body.rate ?? '').trim();
    const cleanRate = rate.replace(/,/g, '');

    if (!rate) {
      return res.status(400).json({
        success: false,
        message: 'Exchange rate is required.',
      });
    }

    if (!/^\d+(?:\.\d+)?$/.test(cleanRate)) {
      return res.status(400).json({
        success: false,
        message: 'Exchange rate must be a valid number.',
      });
    }

    const numericRate = Number(cleanRate);

    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Exchange rate must be greater than zero.',
      });
    }

    const result = await db.query(
      `INSERT INTO exchange_rates (rate, updated_at)
       VALUES ($1, NOW())
       RETURNING
         id,
         rate,
         updated_at AS "updatedAt"`,
      [numericRate],
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('[Exchange] Save failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to save exchange rate.',
    });
  }
}

app.get('/api/exchange', async (req, res) => {
  try {
    const exchange = await getExchangeRate();

    res.json({
      success: true,
      data: exchange,
    });
  } catch (error) {
    console.error('[Exchange] GET failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load exchange rate.',
    });
  }
});

app.get('/api/exchange-rate', async (req, res) => {
  try {
    const exchange = await getExchangeRate();

    res.json({
      success: true,
      data: exchange,
    });
  } catch (error) {
    console.error('[Exchange] GET failed:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to load exchange rate.',
    });
  }
});

app.post('/api/exchange', saveExchangeRate);

app.put('/api/exchange', saveExchangeRate);

app.post('/api/exchange-rate', saveExchangeRate);

app.put('/api/exchange-rate', saveExchangeRate);

function profilePayload(row) {
  return {
    name: row.name || '',
    age: row.age == null ? null : Number(row.age),
    gender: row.gender || null,
    location: row.location || '',
    profileImage: row.profileImage ? '/api/profile/image' : '',
    profileCompleted: Boolean(row.profileCompleted),
    updatedAt: row.updatedAt,
  };
}

function validateProfileInput(body) {
  const name = String(body?.name ?? '').trim().replace(/\s+/g, ' ');
  const ageText = String(body?.age ?? '').trim();
  const age = Number(ageText);
  const gender = String(body?.gender ?? '').trim().toLowerCase();
  const location = String(body?.location ?? '').trim().replace(/\s+/g, ' ');

  if (!name || name.length > 100) return { error: 'Name is required and must be 100 characters or fewer.' };
  if (!/^\d{1,3}$/.test(ageText) || !Number.isInteger(age) || age < 13 || age > 120) {
    return { error: 'Age must be a whole number between 13 and 120.' };
  }
  if (!['male', 'female'].includes(gender)) return { error: 'Gender must be male or female.' };
  if (location.length > 120) return { error: 'Location must be 120 characters or fewer.' };
  return { value: { name, age, gender, location } };
}

const profileSelect = `
  SELECT name, age, gender, location,
         profile_image AS "profileImage",
         profile_completed AS "profileCompleted",
         updated_at AS "updatedAt"
    FROM profiles
   WHERE user_id = $1`;

app.get('/api/profile', requireMobileUser, async (req, res) => {
  try {
    const result = await db.query(profileSelect, [req.mobileUser.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }
    return res.json({ success: true, data: profilePayload(result.rows[0]) });
  } catch (error) {
    console.error('[Profile] Load failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load profile.' });
  }
});

app.get('/api/profile/image', requireMobileUser, async (req, res, next) => {
  try {
    const result = await db.query('SELECT profile_image FROM profiles WHERE user_id = $1', [req.mobileUser.id]);
    const storedPath = String(result.rows[0]?.profile_image || '');
    const filename = path.basename(storedPath);
    if (!storedPath.startsWith('/uploads/profile/') || !/^profile-[a-f0-9-]+\.(?:jpg|png|webp)$/i.test(filename)) {
      return res.status(404).end();
    }
    return res.sendFile(path.join(profileUploadDir, filename), {
      dotfiles: 'deny',
      headers: { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store' },
    }, (error) => {
      if (error && !res.headersSent) next(error);
    });
  } catch (error) {
    return next(error);
  }
});

app.put('/api/profile', requireMobileUser, async (req, res) => {
  const validated = validateProfileInput(req.body);
  if (validated.error) {
    return res.status(400).json({ success: false, message: validated.error });
  }
  try {
    const { name, age, gender, location } = validated.value;
    const result = await db.query(
      `UPDATE profiles
          SET name = $1, age = $2, gender = $3, location = $4,
              profile_completed = true, updated_at = NOW()
        WHERE user_id = $5
        RETURNING name, age, gender, location,
                  profile_image AS "profileImage",
                  profile_completed AS "profileCompleted",
                  updated_at AS "updatedAt"`,
      [name, age, gender, location, req.mobileUser.id],
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Profile not found.' });
    }
    return res.json({ success: true, data: profilePayload(result.rows[0]) });
  } catch (error) {
    console.error('[Profile] Save failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save profile.' });
  }
});

app.post('/api/profile/image', requireMobileUser, profileUploadMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile image was uploaded.',
      });
    }

    const profileImage = `/uploads/profile/${req.file.filename}`;

    const currentResult = await db.query(profileSelect, [req.mobileUser.id]);
    const currentProfile = currentResult.rows[0];
    const result = await db.query(
      `UPDATE profiles
         SET profile_image = $1,
             updated_at = NOW()
         WHERE user_id = $2
         RETURNING
           name,
           age,
           gender,
           location,
           profile_image AS "profileImage",
           profile_completed AS "profileCompleted",
           updated_at AS "updatedAt"`,
      [profileImage, req.mobileUser.id],
    );

    if (!result.rows[0]) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
      });
    }

    const previousImage = String(currentProfile?.profileImage || '');
    if (previousImage.startsWith('/uploads/profile/')) {
      const previousPath = path.join(profileUploadDir, path.basename(previousImage));
      if (previousPath !== req.file.path && fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
    }

    return res.json({
      success: true,
      data: profilePayload(result.rows[0]),
      message: 'Profile image uploaded successfully.',
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Best-effort cleanup.
      }
    }
    console.error('Profile image upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Unable to upload profile image.',
    });
  }
});

app.post('/api/support', (req, res) => {
  const body = req.body || {};

  const message = {
    id: Date.now(),
    name: String(body.name || '').trim(),
    contact: String(body.contact || '').trim(),
    message: String(body.message || '').trim(),
    createdAt: new Date().toISOString(),
  };

  if (!message.message) {
    return res.status(400).json({
      success: false,
      message: 'Support message is required.',
    });
  }

  const messages = readJson(supportFile, []);

  messages.unshift(message);

  writeJson(supportFile, messages);

  res.status(201).json({
    success: true,
    data: message,
  });
});

app.post('/api/notifications/register-token', (req, res) => {
  const body = req.body || {};

  const token = String(body.token || '').trim();

  if (!token) {
    return res.status(400).json({
      success: false,
      message: 'Notification token is required.',
    });
  }

  const tokens = readJson(notificationTokensFile, []);

  const record = {
    token,
    platform: String(body.platform || 'unknown').trim(),
    updatedAt: new Date().toISOString(),
  };

  const nextTokens = Array.isArray(tokens) ? tokens.filter((item) => item?.token !== token) : [];

  nextTokens.unshift(record);

  writeJson(notificationTokensFile, nextTokens);

  res.status(201).json({
    success: true,
    data: record,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((error, req, res, _next) => {
  console.error('API Error:', error);

  const status = error.type === 'entity.too.large' || error.code === 'LIMIT_FILE_SIZE' ? 413 : 500;

  res.status(status).json({
    success: false,
    message: status === 413 ? 'Request body is too large.' : 'Internal server error.',
  });
});

if (require.main === module) {
  const server = app.listen(PORT, HOST, () => {
    console.log('==========================================');
    console.log('       MALAY MM LOCAL API SERVER');
    console.log('==========================================');
    console.log(`Listening on ${HOST}:${PORT}`);
    console.log(`CORS origins: ${allowedCorsOrigins.join(', ')}`);
    console.log(`[Email] SMTP configured: ${isEmailConfigured() ? 'yes' : 'no'}`);
    console.log('==========================================');
  });

  server.on('error', (error) => {
    console.error('Server failed to start:', error);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] Received ${signal}; draining server.`);
    server.close(async (error) => {
      if (error) {
        console.error('[Shutdown] HTTP server close failed:', error.message);
        process.exitCode = 1;
      }
      try {
        await db.end();
      } catch (poolError) {
        console.error('[Shutdown] Database pool close failed:', poolError.message);
        process.exitCode = 1;
      }
      process.exit();
    });
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

module.exports = app;

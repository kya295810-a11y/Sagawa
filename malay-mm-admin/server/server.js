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
const contentCache = require('./content-cache');
const { savePushToken, removePushTokens, sendContentPush } = require('./push-notifications');
const {
  ADMIN_EMAIL,
  ADMIN_NAME,
  ADMIN_ORIGIN,
  VERIFICATION_CODE_COOKIE_NAME,
  beginAuthentication,
  beginRegistration,
  clearSessionCookie,
  createSession,
  createTrustedBrowserToken,
  createVerificationState,
  hasVerificationState,
  invalidateVerificationState,
  createPasswordResetState,
  validateResetCode,
  destroyAllSessions,
  destroySession,
  finishAuthentication,
  finishRegistration,
  getAuthenticatedUser,
  isAdminAuthenticated,
  isTrustedAdminBrowser,
  login,
  requireAdmin,
  requireRecentAdminAuth,
  replaceAdminPasswordHash,
  setSessionCookie,
  validatePasswordPolicy,
  validateVerificationCode,
  verifyPassword,
} = require('./auth');
const {
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
} = require('./user-auth');
const { isEmailConfigured, sendVerificationCode, sendPasswordResetCode } = require('./email');
const {
  authCapabilities,
  requestLoginVerification,
  requestPasswordLoginVerification,
  requestSignupVerification,
  verifyLogin: verifyLoginCode,
  verifySignup: verifySignupCode,
} = require('./auth-otp');
const {
  authenticateGoogleCallback,
  createGoogleAuthorizationUrl,
  createNativeGoogleConfig,
  getGoogleAppRedirectUri,
  isGoogleAuthConfigured,
  verifyGoogleIdToken,
} = require('./google-auth');
const { scheduleUserSheetSync, verifySheetAccess } = require('./google-sheets-sync');
const r2Media = require('./r2-media');
const {
  VIDEO_LIMIT_BYTES,
  fileMatchesSignature,
  validateUploadMetadata,
} = require('./news-media');

const app = express();

function boundedCacheTtl(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.trunc(parsed));
}

const NEWS_CACHE_TTL_MS = boundedCacheTtl(process.env.NEWS_CACHE_TTL_MS, 30000, 300000);
const SERVICES_CACHE_TTL_MS = boundedCacheTtl(process.env.SERVICES_CACHE_TTL_MS, 60000, 300000);
const EXCHANGE_CACHE_TTL_MS = boundedCacheTtl(process.env.EXCHANGE_CACHE_TTL_MS, 15000, 60000);
const ANALYTICS_CONTENT_CACHE_TTL_MS = boundedCacheTtl(process.env.ANALYTICS_CONTENT_CACHE_TTL_MS, 60000, 300000);

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

function cleanMediaUrl(value, fieldName) {
  const url = boundedText(value, 4096, fieldName);
  if (/^(?:data:|blob:|file:)/i.test(url)) {
    const error = new Error(`${fieldName} must reference an uploaded file or an HTTP URL.`);
    error.statusCode = 400;
    throw error;
  }
  return url;
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

const adminProfileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 4 },
  fileFilter: (_req, file, cb) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return cb(new Error('Admin photo must be JPEG, PNG, or WebP.'));
    }
    cb(null, true);
  },
});

function adminAvatarMatchesMime(buffer, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return false;
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const isWebp =
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  return (
    (mimetype === 'image/jpeg' && isJpeg) ||
    (mimetype === 'image/png' && isPng) ||
    (mimetype === 'image/webp' && isWebp)
  );
}

function adminAvatarDataUrl(row) {
  if (!row?.avatar_data || !row?.avatar_mime) return '';
  return `data:${row.avatar_mime};base64,${Buffer.from(row.avatar_data).toString('base64')}`;
}

async function readAdminProfile() {
  const result = await db.query(
    'SELECT name, avatar_data, avatar_mime, updated_at FROM admin_profile WHERE id = 1',
  );
  const row = result.rows[0] || {};
  return {
    name: String(row.name || ADMIN_NAME || 'Admin').trim() || 'Admin',
    email: ADMIN_EMAIL,
    avatarUrl: adminAvatarDataUrl(row),
    updatedAt: row.updated_at || null,
  };
}

const defaultContentUploadDir = path.join(__dirname, 'uploads', 'content');
const newsUploadDir = path.resolve(
  process.env.NEWS_UPLOAD_DIR || path.join(defaultContentUploadDir, 'news'),
);
fs.mkdirSync(newsUploadDir, { recursive: true });


const newsStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, newsUploadDir),
  filename: (_req, file, cb) => {
    try {
      const { extension } = validateUploadMetadata({ ...file, size: 0 });
      cb(null, `news-${file.fieldname}-${crypto.randomUUID()}${extension}`);
    } catch (error) {
      cb(error);
    }
  },
});

const newsUpload = multer({
  storage: newsStorage,
  limits: { fileSize: VIDEO_LIMIT_BYTES, files: 3, fields: 12 },
  fileFilter: (_req, file, cb) => {
    try {
      validateUploadMetadata({ ...file, size: 0 });
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
});

function removeUploadedFiles(files) {
  for (const file of Object.values(files || {}).flat()) {
    try {
      fs.unlinkSync(file.path);
    } catch {
      // Best-effort cleanup of rejected or unused uploads.
    }
  }
}

const newsUploadMiddleware = (req, res, next) => {
  newsUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ])(req, res, (error) => {
    if (error) {
      removeUploadedFiles(req.files);
      const tooLarge = error.code === 'LIMIT_FILE_SIZE' || error.statusCode === 413;
      return res.status(tooLarge ? 413 : 422).json({
        success: false,
        message: tooLarge
          ? 'Video must be 100 MB or smaller; images must be 10 MB or smaller.'
          : error.message || 'Invalid news media upload.',
      });
    }

    try {
      for (const file of Object.values(req.files || {}).flat()) {
        validateUploadMetadata(file);
        if (!fileMatchesSignature(file.path, file.mimetype, fs)) {
          throw Object.assign(new Error(`${file.fieldname} file contents do not match its type.`), {
            statusCode: 422,
          });
        }
      }
      next();
    } catch (validationError) {
      removeUploadedFiles(req.files);
      return res.status(validationError.statusCode || 422).json({
        success: false,
        message: validationError.message || 'Invalid news media upload.',
      });
    }
  });
};

const exchangeProviderUploadDir = path.resolve(
  process.env.EXCHANGE_PROVIDER_UPLOAD_DIR ||
    path.join(defaultContentUploadDir, 'exchange-providers'),
);
fs.mkdirSync(exchangeProviderUploadDir, { recursive: true });


const exchangeProviderStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, exchangeProviderUploadDir),
  filename: (_req, file, cb) => {
    try {
      const { extension } = validateUploadMetadata({
        ...file,
        fieldname: 'image',
        size: 0,
      });
      cb(null, `exchange-provider-${crypto.randomUUID()}${extension}`);
    } catch (error) {
      cb(error);
    }
  },
});

const exchangeProviderUpload = multer({
  storage: exchangeProviderStorage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 8 },
  fileFilter: (_req, file, cb) => {
    try {
      validateUploadMetadata({ ...file, fieldname: 'image', size: 0 });
      cb(null, true);
    } catch (error) {
      cb(error);
    }
  },
});

const exchangeProviderUploadMiddleware = (req, res, next) => {
  exchangeProviderUpload.single('logo')(req, res, (error) => {
    if (error) {
      if (req.file?.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // Best-effort cleanup.
        }
      }
      const tooLarge = error.code === 'LIMIT_FILE_SIZE' || error.statusCode === 413;
      return res.status(tooLarge ? 413 : 422).json({
        success: false,
        message: tooLarge
          ? 'Provider logo must be 2 MB or smaller.'
          : error.message || 'Provider logo must be a JPEG, PNG, or WebP image.',
      });
    }

    if (!req.file) return next();

    try {
      if (!fileMatchesSignature(req.file.path, req.file.mimetype, fs)) {
        throw new Error('Provider logo contents do not match its file type.');
      }
      return next();
    } catch (validationError) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Best-effort cleanup.
      }
      return res.status(422).json({
        success: false,
        message: validationError.message || 'Invalid provider logo.',
      });
    }
  });
};


function normalizeAnalyticsContentType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'news' || type === 'service' ? type : '';
}

function analyticsViewerHash(viewerId) {
  const normalized = String(viewerId || '').trim();
  if (!/^[A-Za-z0-9_-]{16,160}$/.test(normalized)) return '';
  return crypto.createHmac('sha256', process.env.SESSION_SECRET || 'sagawa-analytics')
    .update(normalized)
    .digest('hex');
}

async function analyticsContentExists(contentType, contentId) {
  const normalizedId = String(contentId);
  const cacheKey = `analytics:published:${contentType}:${normalizedId}`;

  return contentCache.getOrLoad(cacheKey, ANALYTICS_CONTENT_CACHE_TTL_MS, async () => {
    const table = contentType === 'news' ? 'news' : 'services';
    const result = await db.query(
      `SELECT 1 FROM ${table} WHERE id = $1 AND published = TRUE LIMIT 1`,
      [normalizedId],
    );
    return result.rows.length > 0;
  });
}

async function recordAnalyticsEvent({ contentType, contentId, eventType, viewerId }) {
  if (!await analyticsContentExists(contentType, contentId)) {
    const error = new Error('Published content not found.');
    error.statusCode = 404;
    throw error;
  }

  const viewerHash = analyticsViewerHash(viewerId);
  let reachIncrement = 0;

  if (eventType === 'view' && viewerHash) {
    const reachResult = await db.query(
      `INSERT INTO content_reach
        (content_type, content_id, viewer_hash, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (content_type, content_id, viewer_hash)
       DO NOTHING
       RETURNING 1 AS inserted`,
      [contentType, String(contentId), viewerHash],
    );
    reachIncrement = reachResult.rows.length > 0 ? 1 : 0;
  }

  const viewIncrement = eventType === 'view' ? 1 : 0;
  const clickIncrement = eventType === 'click' ? 1 : 0;

  const result = await db.query(
    `INSERT INTO content_analytics
      (content_type, content_id, views, clicks, reach, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (content_type, content_id)
     DO UPDATE SET
       views = content_analytics.views + EXCLUDED.views,
       clicks = content_analytics.clicks + EXCLUDED.clicks,
       reach = content_analytics.reach + EXCLUDED.reach,
       updated_at = NOW()
     RETURNING views, clicks, reach, updated_at AS "updatedAt"`,
    [contentType, String(contentId), viewIncrement, clickIncrement, reachIncrement],
  );

  return result.rows[0];
}

async function deleteAnalyticsForContent(contentType, contentId) {
  await db.query(
    'DELETE FROM content_reach WHERE content_type = $1 AND content_id = $2',
    [contentType, String(contentId)],
  );
  await db.query(
    'DELETE FROM content_analytics WHERE content_type = $1 AND content_id = $2',
    [contentType, String(contentId)],
  );
}

function parseBoolean(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return /^(1|true|yes|on)$/i.test(String(value));
}

async function newsFileUrl(file) {
  return file ? r2Media.uploadFile(file, 'news') : '';
}

function normalizeMediaType(value, imageUrl, videoUrl) {
  if (value === 'image' || value === 'video') return value;
  return videoUrl ? 'video' : imageUrl ? 'image' : 'image';
}

function mapNewsRow(row) {
  const imageUrl = row.image_url || row.image_name || '';
  const videoUrl = row.video_url || '';
  const thumbnailUrl = row.thumbnail_url || (videoUrl ? imageUrl : '') || '';
  const mediaType = normalizeMediaType(row.media_type, imageUrl, videoUrl);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    mediaType,
    imageUrl,
    videoUrl,
    thumbnailUrl,
    published: row.published,
    date: row.date,
    views: Number(row.views || 0),
    clicks: Number(row.clicks || 0),
    reach: Number(row.reach || 0),
    // Transitional aliases for older app builds.
    image: mediaType === 'video' ? thumbnailUrl : imageUrl,
    video: videoUrl,
  };
}

async function removeStoredNewsMedia(...urls) {
  for (const url of new Set(urls.filter(Boolean))) {
    try {
      await r2Media.deleteFile(url);
    } catch (error) {
      console.error('[News] Media cleanup failed:', error.message);
    }
  }
}

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Sagawa-Browser-Id', 'X-Sagawa-Trusted-Browser'],
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

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, message: 'Too many support messages. Try again later.' },
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
app.use(
  express.urlencoded({
    extended: true,
    limit: '64kb',
  }),
);

app.get('/api/auth/capabilities', (_req, res) => {
  return res.json({ success: true, data: authCapabilities() });
});

app.post('/api/auth/register', resendLimiter, async (req, res) => {
  try {
    const challenge = await requestSignupVerification({
      nameValue: req.body?.name,
      ageValue: req.body?.age,
      identifierValue: req.body?.identifier ?? req.body?.email ?? req.body?.phone,
      channelValue: req.body?.channel || (req.body?.phone ? 'phone' : 'email'),
      country: req.body?.country,
      password: req.body?.password,
    });

    return res.status(202).json({
      success: true,
      data: { ...challenge, verificationRequired: true },
      message: 'Verification code sent.',
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Mobile registration request failed:', error.message);
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to start account verification.' : error.message,
    });
  }
});

app.post('/api/auth/register/verify', async (req, res) => {
  try {
    const result = await verifySignupCode(
      String(req.body?.challengeId || '').trim(),
      String(req.body?.code || '').trim(),
    );
    if (!result || result.error) {
      const tooMany = result?.error === 'too_many_attempts';
      return res.status(tooMany ? 429 : 401).json({
        success: false,
        message: tooMany
          ? 'Too many incorrect attempts. Request a new code.'
          : 'The verification code is invalid or expired.',
      });
    }

    scheduleUserSheetSync(result.user.id, { platform: req.body?.platform || 'Mobile' });
    return res.status(201).json({
      success: true,
      data: { ...result, profileCompleted: true },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Mobile registration verification failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to verify account.' : error.message,
    });
  }
});

app.post('/api/auth/login/code/request', resendLimiter, async (req, res) => {
  try {
    const challenge = await requestLoginVerification({
      identifierValue: req.body?.identifier ?? req.body?.email ?? req.body?.phone,
      channelValue: req.body?.channel || (req.body?.phone ? 'phone' : 'email'),
      country: req.body?.country,
    });
    return res.status(202).json({
      success: true,
      data: { ...challenge, verificationRequired: true },
      message: 'Verification code sent.',
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Login code request failed:', error.message);
    if (error.retryAfter) res.setHeader('Retry-After', String(error.retryAfter));
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to send login code.' : error.message,
    });
  }
});

app.post('/api/auth/login/code/verify', async (req, res) => {
  try {
    const result = await verifyLoginCode(
      String(req.body?.challengeId || '').trim(),
      String(req.body?.code || '').trim(),
    );
    if (!result || result.error) {
      const tooMany = result?.error === 'too_many_attempts';
      return res.status(tooMany ? 429 : 401).json({
        success: false,
        message: tooMany
          ? 'Too many incorrect attempts. Request a new code.'
          : 'The verification code is invalid or expired.',
      });
    }

    scheduleUserSheetSync(result.user.id, { platform: req.body?.platform || 'Mobile' });
    return res.json({
      success: true,
      data: { ...result, authenticated: true },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Login code verification failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to verify login code.' : error.message,
    });
  }
});

app.post('/api/auth/biometric/enroll', requireMobileUser, async (req, res) => {
  try {
    const credential = await createBiometricCredential(req.mobileUser.id, req.body?.platform);
    return res.status(201).json({ success: true, data: { credential } });
  } catch (error) {
    console.error('[Auth] Biometric enrollment failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to enable biometric sign-in.' });
  }
});

app.post('/api/auth/biometric/login', async (req, res) => {
  try {
    const session = await loginWithBiometricCredential(req.body?.credential, req.body?.platform);
    if (!session) {
      return res.status(401).json({ success: false, message: 'Biometric sign-in is no longer available on this device.' });
    }
    return res.json({ success: true, data: session });
  } catch (error) {
    console.error('[Auth] Biometric login failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to sign in with biometrics.' });
  }
});

app.delete('/api/auth/biometric', requireMobileUser, async (req, res) => {
  try {
    await revokeBiometricCredential(req.mobileUser.id, req.body?.platform);
    return res.status(204).end();
  } catch (error) {
    console.error('[Auth] Biometric removal failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to disable biometric sign-in.' });
  }
});

app.get('/api/auth/google/start', (req, res) => {
  if (!isGoogleAuthConfigured()) {
    return res.status(503).json({
      success: false,
      message: 'Google sign-in is not configured yet.',
      code: 'google_auth_not_configured',
    });
  }

  try {
    return res.json({
      success: true,
      data: {
        authorizationUrl: createGoogleAuthorizationUrl(),
      },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Google start failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Google sign-in is unavailable.' : error.message,
      code: error.code || 'google_auth_error',
    });
  }
});

app.get('/api/auth/google/native-config', (req, res) => {
  try {
    return res.json({
      success: true,
      data: createNativeGoogleConfig(),
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Native Google config failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Google sign-in is unavailable.' : error.message,
      code: error.code || 'google_auth_error',
    });
  }
});

app.post('/api/auth/google/native', async (req, res) => {
  const idToken = req.body?.idToken;
  const nonce = req.body?.nonce;

  if (typeof idToken !== 'string' || !idToken || typeof nonce !== 'string' || !nonce) {
    return res.status(400).json({
      success: false,
      message: 'Google identity token and nonce are required.',
      code: 'invalid_google_native_request',
    });
  }

  try {
    const identity = await verifyGoogleIdToken(idToken, nonce);
    const googleUser = await loginOrRegisterGoogleUser(identity);
    const session = await createMobileSessionForUser(googleUser.user.id);

    if (!session) {
      throw new Error('Google-authenticated user could not be loaded.');
    }

    scheduleUserSheetSync(session.user.id, { platform: req.body?.platform || 'Mobile' });

    return res.json({
      success: true,
      data: {
        ...session,
        authenticated: true,
      },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Native Google sign-in failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to complete Google sign-in.' : error.message,
      code: error.code || 'google_auth_error',
    });
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  const appRedirectUri = getGoogleAppRedirectUri();
  const redirectToApp = (params) => {
    const url = new URL(appRedirectUri);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
    return res.redirect(302, url.toString());
  };

  if (req.query?.error) {
    return redirectToApp({
      error: String(req.query.error).slice(0, 80),
      error_description: String(req.query.error_description || 'Google sign-in was cancelled.').slice(0, 240),
    });
  }

  try {
    const identity = await authenticateGoogleCallback(req.query?.code, req.query?.state);
    const user = await loginOrRegisterGoogleUser(identity);
    const handoffCode = await createOAuthHandoff(user.user.id);

    return redirectToApp({
      code: handoffCode,
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Auth] Google callback failed:', error.message);
    return redirectToApp({
      error: error.code || 'google_auth_error',
      error_description: status >= 500 ? 'Google sign-in is temporarily unavailable.' : error.message,
    });
  }
});

app.post('/api/auth/google/exchange', async (req, res) => {
  try {
    const session = await consumeOAuthHandoff(req.body?.code);
    if (!session) {
      return res.status(401).json({
        success: false,
        message: 'Google sign-in code is invalid or expired.',
        code: 'invalid_google_handoff',
      });
    }

    scheduleUserSheetSync(session.user.id, { platform: req.body?.platform || 'Mobile' });

    return res.json({
      success: true,
      data: {
        ...session,
        authenticated: true,
      },
    });
  } catch (error) {
    console.error('[Auth] Google exchange failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Unable to complete Google sign-in.',
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const identifier = String(req.body?.identifier || req.body?.email || req.body?.phone || '').trim();
  const password = req.body?.password;
  const isMobileRequest = req.body?.accountType === 'mobile';

  if ((!isMobileRequest && !email) || (isMobileRequest && !identifier) || typeof password !== 'string' || !password) {
    return res.status(400).json({
      success: false,
      message: isMobileRequest ? 'Email or phone number and password are required.' : 'Email and password are required.',
    });
  }

  try {
    if (isMobileRequest || normalizeEmail(email) !== ADMIN_EMAIL) {
      const mobileUser = await authenticatePasswordUser(identifier, password);
      if (!mobileUser) {
        return res.status(401).json({ success: false, message: 'Invalid email/phone number or password.' });
      }

      const challenge = await requestPasswordLoginVerification(mobileUser);
      return res.status(202).json({
        success: true,
        data: {
          authenticated: false,
          verificationRequired: true,
          ...challenge,
        },
        message: 'Verification code sent.',
      });
    }

    if (!(await login(email, password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const browserId = String(req.headers['x-sagawa-browser-id'] || '').trim();
    const trustedBrowserToken = String(req.headers['x-sagawa-trusted-browser'] || '').trim();

    if (isTrustedAdminBrowser(req, browserId, trustedBrowserToken)) {
      const sessionToken = createSession({
        authMethod: 'password+trusted-browser',
        strongAuthAt: Date.now(),
      });
      setSessionCookie(res, sessionToken);

      console.log('[Auth] Admin password login succeeded from trusted browser.');

      return res.json({
        success: true,
        data: {
          authenticated: true,
          verificationRequired: false,
          sessionToken,
          user: {
            name: ADMIN_NAME || 'Admin',
            email: ADMIN_EMAIL,
          },
        },
      });
    }

    if (!isEmailConfigured()) {
      console.error('[Auth] Admin two-step verification unavailable: email service is not configured.');
      return res.status(503).json({
        success: false,
        message: 'Admin email verification is temporarily unavailable.',
      });
    }

    const verification = createVerificationState();

    try {
      await sendVerificationCode(ADMIN_EMAIL, verification.code);
    } catch (emailError) {
      console.error('[Auth] Failed to send admin login verification code:', emailError.message);
      return res.status(503).json({
        success: false,
        message: 'Could not send the admin verification code. Please try again.',
      });
    }

    console.log('[Auth] Admin password verified; email verification required.');

    return res.json({
      success: true,
      data: {
        authenticated: false,
        verificationRequired: true,
        verificationId: verification.stateId,
        verificationExpiresAt: new Date(verification.expiresAt).toISOString(),
        emailHint: ADMIN_EMAIL.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2'),
      },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) {
      console.error('[Auth] Login failed:', error.message);
    }

    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Authentication service unavailable.' : error.message,
    });
  }
});

app.post('/api/auth/admin/verify-email', async (req, res) => {
  const verificationId = String(req.body?.verificationId || '').trim();
  const code = String(req.body?.code || '').trim();

  if (!verificationId || !/^\d{6}$/.test(code)) {
    return res.status(400).json({
      success: false,
      message: 'A valid verification code is required.',
    });
  }

  const validation = validateVerificationCode(verificationId, code, 'admin-login');
  if (!validation.valid) {
    console.warn('[Auth] Admin email verification failed:', validation.reason);
    return res.status(401).json({
      success: false,
      message: validation.reason === 'too_many_attempts'
        ? 'Too many incorrect attempts. Sign in again to request a new code.'
        : 'The verification code is invalid or expired.',
    });
  }

  const user = {
    name: ADMIN_NAME || 'Admin',
    email: ADMIN_EMAIL,
  };

  const sessionToken = createSession({
    authMethod: 'password+email',
    strongAuthAt: Date.now(),
  });
  setSessionCookie(res, sessionToken);

  const browserId = String(req.headers['x-sagawa-browser-id'] || '').trim();
  const trustedBrowserToken = createTrustedBrowserToken(req, browserId);

  console.log('[Auth] Admin two-step verification succeeded.');

  return res.json({
    success: true,
    data: {
      authenticated: true,
      sessionToken,
      trustedBrowserToken: trustedBrowserToken || undefined,
      user,
    },
  });
});

app.post('/api/auth/admin/resend-verification', resendLimiter, async (req, res) => {
  const previousId = String(req.body?.verificationId || '').trim();

  if (!previousId || !hasVerificationState(previousId, 'admin-login')) {
    return res.status(401).json({
      success: false,
      message: 'This verification request is no longer valid. Sign in again.',
    });
  }

  invalidateVerificationState(previousId);
  const verification = createVerificationState();

  try {
    await sendVerificationCode(ADMIN_EMAIL, verification.code);
  } catch (error) {
    console.error('[Auth] Admin verification resend failed:', error.message);
    return res.status(503).json({
      success: false,
      message: 'Could not resend the verification code. Please try again.',
    });
  }

  return res.json({
    success: true,
    data: {
      verificationRequired: true,
      verificationId: verification.stateId,
      verificationExpiresAt: new Date(verification.expiresAt).toISOString(),
      emailHint: ADMIN_EMAIL.replace(/^(.{1,2}).*(@.*)$/, '$1•••$2'),
    },
  });
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

app.get('/api/admin/profile', requireAdmin, async (req, res) => {
  try {
    return res.json({ success: true, data: await readAdminProfile() });
  } catch (error) {
    console.error('[AdminProfile] GET failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load admin profile.' });
  }
});

app.put(
  '/api/admin/profile',
  requireAdmin,
  adminProfileUpload.single('avatar'),
  async (req, res) => {
    try {
      const name = boundedText(req.body?.name, 80, 'Admin name');
      if (!name) {
        return res.status(400).json({ success: false, message: 'Admin name is required.' });
      }

      if (req.file && !adminAvatarMatchesMime(req.file.buffer, req.file.mimetype)) {
        return res.status(422).json({
          success: false,
          message: 'Uploaded admin photo does not match its file type.',
        });
      }

      if (req.file) {
        await db.query(
          `UPDATE admin_profile
             SET name = $1,
                 avatar_data = $2,
                 avatar_mime = $3,
                 updated_at = NOW()
           WHERE id = 1`,
          [name, req.file.buffer, req.file.mimetype],
        );
      } else {
        await db.query(
          'UPDATE admin_profile SET name = $1, updated_at = NOW() WHERE id = 1',
          [name],
        );
      }

      return res.json({ success: true, data: await readAdminProfile() });
    } catch (error) {
      if (error?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ success: false, message: 'Admin photo must be 2 MB or smaller.' });
      }
      console.error('[AdminProfile] PUT failed:', error.message);
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.statusCode ? error.message : 'Could not update admin profile.',
      });
    }
  },
);

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

app.post('/api/auth/passkey/authentication-options', async (req, res) => {
  try {
    const options = await beginAuthentication();
    return res.json({ success: true, data: options });
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
    const sessionToken = createSession({
      authMethod: 'passkey',
      strongAuthAt: Date.now(),
    });
    setSessionCookie(res, sessionToken);
    console.log('[Auth] Passkey login succeeded.');
    return res.json({
      success: true,
      data: {
        authenticated: true,
        sessionToken,
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

app.post('/api/auth/passkey/registration-options', requireRecentAdminAuth, async (req, res) => {
  try {
    const options = await beginRegistration(req);
    return res.json({ success: true, data: options });
  } catch (error) {
    console.error('[Auth] Passkey registration options failed:', error.message);
    return res
      .status(400)
      .json({ success: false, message: 'Passkey registration is unavailable.' });
  }
});

app.post('/api/auth/passkey/registration', requireRecentAdminAuth, async (req, res) => {
  try {
    await finishRegistration(req, req.body);
    console.log('[Auth] Passkey registration succeeded.');
    return res.json({ success: true });
  } catch (error) {
    console.error('[Auth] Passkey registration failed:', error.message);
    return res.status(400).json({ success: false, message: 'Passkey registration failed.' });
  }
});


app.post('/api/analytics/event', async (req, res) => {
  try {
    const contentType = normalizeAnalyticsContentType(req.body?.contentType);
    const contentId = String(req.body?.contentId || '').trim();
    const eventType = String(req.body?.eventType || '').trim().toLowerCase();
    const viewerId = String(req.body?.viewerId || '').trim();

    if (!contentType || !contentId || !['view', 'click'].includes(eventType)) {
      return res.status(400).json({
        success: false,
        message: 'A valid content type, content ID, and analytics event are required.',
      });
    }

    const data = await recordAnalyticsEvent({
      contentType,
      contentId,
      eventType,
      viewerId,
    });

    return res.status(202).json({ success: true, data });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Analytics] Event failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status === 404 ? 'Published content not found.' : 'Could not record analytics.',
    });
  }
});

app.get('/api/admin/analytics', requireAdmin, async (_req, res) => {
  try {
    const summaryResult = await db.query(`
      SELECT
        COALESCE(SUM(views), 0)::bigint AS views,
        COALESCE(SUM(clicks), 0)::bigint AS clicks,
        COALESCE(SUM(reach), 0)::bigint AS reach
      FROM content_analytics
    `);

    const itemsResult = await db.query(`
      SELECT
        ca.content_type AS "contentType",
        ca.content_id AS "contentId",
        CASE
          WHEN ca.content_type = 'news' THEN n.title
          ELSE s.title
        END AS title,
        CASE
          WHEN ca.content_type = 'news' THEN n.published
          ELSE s.published
        END AS published,
        ca.views::bigint AS views,
        ca.clicks::bigint AS clicks,
        ca.reach::bigint AS reach,
        ca.updated_at AS "updatedAt"
      FROM content_analytics ca
      LEFT JOIN news n
        ON ca.content_type = 'news' AND n.id = ca.content_id
      LEFT JOIN services s
        ON ca.content_type = 'service' AND s.id = ca.content_id
      WHERE (ca.content_type = 'news' AND n.id IS NOT NULL)
         OR (ca.content_type = 'service' AND s.id IS NOT NULL)
      ORDER BY ca.views DESC, ca.clicks DESC, ca.updated_at DESC
    `);

    const summary = summaryResult.rows[0] || {};
    return res.json({
      success: true,
      data: {
        summary: {
          views: Number(summary.views || 0),
          clicks: Number(summary.clicks || 0),
          reach: Number(summary.reach || 0),
        },
        items: itemsResult.rows.map((row) => ({
          ...row,
          views: Number(row.views || 0),
          clicks: Number(row.clicks || 0),
          reach: Number(row.reach || 0),
        })),
      },
    });
  } catch (error) {
    console.error('[Analytics] Admin report failed:', error.message);
    return res.status(500).json({ success: false, message: 'Could not load analytics.' });
  }
});

// Public GETs are consumed by the mobile app. All admin mutations require a session.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth/') || req.path === '/auth/me') return next();
  if (req.path === '/profile' || req.path.startsWith('/profile/')) return next();
  if (req.path === '/support' && req.method === 'POST') return next();
  if (req.path === '/analytics/event' && req.method === 'POST') return next();
  if (req.path === '/notifications/register-token' && req.method === 'POST') return next();
  if (req.path === '/notifications/unregister-token' && req.method === 'POST') return next();
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
    const isAdmin = isAdminAuthenticated(req);

    if (!isAdmin) {
      const data = await contentCache.getOrLoad('news:list:public', NEWS_CACHE_TTL_MS, async () => {
        const result = await db.query(`
          SELECT
            id,
            title,
            description,
            media_type,
            image_url,
            image_name,
            video_url,
            thumbnail_url,
            published,
            date
          FROM news
          WHERE published = TRUE
          ORDER BY created_at DESC
        `);
        return result.rows.map(mapNewsRow);
      });

      return res.json({ success: true, data });
    }

    const result = await db.query(`
      SELECT
        id,
        title,
        description,
        media_type,
        image_url,
        image_name,
        video_url,
        thumbnail_url,
        news.published,
        news.date,
        COALESCE(content_analytics.views, 0) AS views,
        COALESCE(content_analytics.clicks, 0) AS clicks,
        COALESCE(content_analytics.reach, 0) AS reach
      FROM news
      LEFT JOIN content_analytics
        ON content_analytics.content_type = 'news'
       AND content_analytics.content_id = news.id
      ORDER BY news.created_at DESC
    `);

    return res.json({
      success: true,
      data: result.rows.map(mapNewsRow),
    });
  } catch (error) {
    console.error('[News] GET failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load news.',
    });
  }
});

app.get('/api/news/:id', async (req, res) => {
  try {
    const id = String(req.params.id);
    const isAdmin = isAdminAuthenticated(req);

    if (!isAdmin) {
      const data = await contentCache.getOrLoad(
        `news:item:public:${id}`,
        NEWS_CACHE_TTL_MS,
        async () => {
          const result = await db.query(
            `SELECT
              id,
              title,
              description,
              media_type,
              image_url,
              image_name,
              video_url,
              thumbnail_url,
              published,
              date
             FROM news
             WHERE id = $1
               AND published = TRUE`,
            [id],
          );
          return result.rows[0] ? mapNewsRow(result.rows[0]) : null;
        },
      );

      if (!data) {
        return res.status(404).json({
          success: false,
          message: 'News not found.',
        });
      }

      return res.json({ success: true, data });
    }

    const result = await db.query(
      `SELECT
        id,
        title,
        description,
        media_type,
        image_url,
        image_name,
        video_url,
        thumbnail_url,
        news.published,
        news.date,
        COALESCE(content_analytics.views, 0) AS views,
        COALESCE(content_analytics.clicks, 0) AS clicks,
        COALESCE(content_analytics.reach, 0) AS reach
       FROM news
       LEFT JOIN content_analytics
         ON content_analytics.content_type = 'news'
        AND content_analytics.content_id = news.id
       WHERE news.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found.',
      });
    }

    return res.json({
      success: true,
      data: mapNewsRow(result.rows[0]),
    });
  } catch (error) {
    console.error('[News] GET by id failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to load news.',
    });
  }
});

app.post('/api/news', newsUploadMiddleware, async (req, res) => {
  try {
    const { title, description = '', published = true } = req.body || {};

    const cleanTitle = boundedText(title, 160, 'Title');
    const cleanDescription = boundedText(description, 10000, 'Description');
    const legacyImage = cleanMediaUrl(req.body?.imageUrl || req.body?.image, 'Image URL');
    const legacyVideo = cleanMediaUrl(req.body?.videoUrl || req.body?.video, 'Video URL');
    const legacyThumbnail = cleanMediaUrl(req.body?.thumbnailUrl, 'Thumbnail URL');
    const imageUrl = (await newsFileUrl(req.files?.image?.[0])) || legacyImage;
    const videoUrl = (await newsFileUrl(req.files?.video?.[0])) || legacyVideo;
    const thumbnailUrl = (await newsFileUrl(req.files?.thumbnail?.[0])) || legacyThumbnail;
    const mediaType = normalizeMediaType(req.body?.mediaType || req.body?.media_type, imageUrl, videoUrl);

    if (!cleanTitle) {
      removeUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'Title is required.',
      });
    }

    if (mediaType === 'image' && !imageUrl) {
      removeUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'An image is required.' });
    }
    if (mediaType === 'video' && (!videoUrl || !thumbnailUrl)) {
      removeUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'A video and a thumbnail image are required.',
      });
    }

    const countResult = await db.query('SELECT COUNT(*)::int AS count FROM news');
    if (countResult.rows[0].count >= 10) {
      removeUploadedFiles(req.files);
      return res.status(409).json({ success: false, message: 'A maximum of 10 news items is allowed.' });
    }

    const id = Date.now().toString();

    const result = await db.query(
      `INSERT INTO news
        (id, title, description, media_type, image_url, image_name, video_url, thumbnail_url, published, date)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9)
       RETURNING
         id,
         title,
         description,
         media_type,
         image_url,
         image_name,
         video_url,
         thumbnail_url,
         published,
         date`,
      [
        id,
        cleanTitle,
        cleanDescription,
        mediaType,
        mediaType === 'image' ? imageUrl : '',
        mediaType === 'video' ? videoUrl : '',
        mediaType === 'video' ? thumbnailUrl : '',
        parseBoolean(published, true),
        new Date().toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
      ],
    );

    const createdNews = mapNewsRow(result.rows[0]);
    contentCache.clearPrefix('news:');
    contentCache.clearPrefix('analytics:');

    if (createdNews.published) {
      void sendContentPush({
        type: 'news',
        id: createdNews.id,
        title: createdNews.title,
      }).then((delivery) => {
        console.log('[Push] News notification sent:', delivery);
      }).catch((pushError) => {
        console.error('[Push] News notification failed:', pushError.message);
      });
    }

    res.status(201).json({
      success: true,
      data: createdNews,
    });
  } catch (error) {
    removeUploadedFiles(req.files);
    console.error('[News] POST failed:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to create news.',
    });
  }
});

app.put('/api/news/:id', newsUploadMiddleware, async (req, res) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};

    if (body.title !== undefined) {
      body.title = boundedText(body.title, 160, 'Title');
      if (!body.title) {
        removeUploadedFiles(req.files);
        return res.status(400).json({ success: false, message: 'Title is required.' });
      }
    }
    if (body.description !== undefined) body.description = boundedText(body.description, 10000, 'Description');
    if (body.imageUrl !== undefined || body.image !== undefined) {
      body.imageUrl = cleanMediaUrl(body.imageUrl ?? body.image, 'Image URL');
    }
    if (body.videoUrl !== undefined || body.video !== undefined) {
      body.videoUrl = cleanMediaUrl(body.videoUrl ?? body.video, 'Video URL');
    }
    if (body.thumbnailUrl !== undefined) {
      body.thumbnailUrl = cleanMediaUrl(body.thumbnailUrl, 'Thumbnail URL');
    }

    const existing = await db.query('SELECT * FROM news WHERE id = $1', [id]);

    if (existing.rows.length === 0) {
      removeUploadedFiles(req.files);
      return res.status(404).json({
        success: false,
        message: 'News not found.',
      });
    }

    const current = existing.rows[0];
    const nextImageUrl = (await newsFileUrl(req.files?.image?.[0])) || (body.imageUrl ?? current.image_url ?? current.image_name ?? '');
    const nextVideoUrl = (await newsFileUrl(req.files?.video?.[0])) || (body.videoUrl ?? current.video_url ?? '');
    const nextThumbnailUrl = (await newsFileUrl(req.files?.thumbnail?.[0])) || (body.thumbnailUrl ?? current.thumbnail_url ?? '');
    const nextMediaType = normalizeMediaType(
      body.mediaType || body.media_type || current.media_type,
      nextImageUrl,
      nextVideoUrl,
    );

    if (nextMediaType === 'image' && !nextImageUrl) {
      removeUploadedFiles(req.files);
      return res.status(400).json({ success: false, message: 'An image is required.' });
    }
    if (nextMediaType === 'video' && (!nextVideoUrl || !nextThumbnailUrl)) {
      removeUploadedFiles(req.files);
      return res.status(400).json({
        success: false,
        message: 'A video and a thumbnail image are required.',
      });
    }

    const result = await db.query(
      `UPDATE news
       SET title = $1,
           description = $2,
           media_type = $3,
           image_url = $4,
           image_name = $4,
           video_url = $5,
           thumbnail_url = $6,
           published = $7,
           date = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING
         id,
         title,
         description,
         media_type,
         image_url,
         image_name,
         video_url,
         thumbnail_url,
         published,
         date`,
      [
        body.title ?? current.title,
        body.description ?? current.description,
        nextMediaType,
        nextMediaType === 'image' ? nextImageUrl : '',
        nextMediaType === 'video' ? nextVideoUrl : '',
        nextMediaType === 'video' ? nextThumbnailUrl : '',
        parseBoolean(body.published, current.published),
        body.date ?? current.date,
        id,
      ],
    );

    if (req.files?.image?.[0] || nextMediaType !== 'image') {
      await removeStoredNewsMedia(current.image_url, current.image_name);
    }
    if (req.files?.video?.[0] || nextMediaType !== 'video') await removeStoredNewsMedia(current.video_url);
    if (req.files?.thumbnail?.[0] || nextMediaType !== 'video') await removeStoredNewsMedia(current.thumbnail_url);

    const updatedNews = mapNewsRow(result.rows[0]);
    contentCache.clearPrefix('news:');
    contentCache.clearPrefix('analytics:');

    if (!current.published && updatedNews.published) {
      void sendContentPush({
        type: 'news',
        id: updatedNews.id,
        title: updatedNews.title,
      }).then((delivery) => {
        console.log('[Push] News notification sent:', delivery);
      }).catch((pushError) => {
        console.error('[Push] News notification failed:', pushError.message);
      });
    }

    res.json({
      success: true,
      data: updatedNews,
    });
  } catch (error) {
    removeUploadedFiles(req.files);
    console.error('[News] PUT failed:', error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update news.',
    });
  }
});

app.delete('/api/news/:id', async (req, res) => {
  try {
    const result = await db.query('DELETE FROM news WHERE id = $1 RETURNING id, image_url, image_name, video_url, thumbnail_url', [
      String(req.params.id),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'News not found.',
      });
    }

    await removeStoredNewsMedia(
      result.rows[0].image_url,
      result.rows[0].image_name,
      result.rows[0].video_url,
      result.rows[0].thumbnail_url,
    );
    await deleteAnalyticsForContent('news', result.rows[0].id);
    contentCache.clearPrefix('news:');
    contentCache.clearPrefix('analytics:');

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
    const isAdmin = isAdminAuthenticated(req);

    if (!isAdmin) {
      const data = await contentCache.getOrLoad('services:list:public', SERVICES_CACHE_TTL_MS, async () => {
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
          WHERE published = TRUE
          ORDER BY created_at DESC
        `);
        return result.rows;
      });

      return res.json({ success: true, data });
    }

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
        services.updated_at AS "updatedAt",
        COALESCE(content_analytics.views, 0) AS views,
        COALESCE(content_analytics.clicks, 0) AS clicks,
        COALESCE(content_analytics.reach, 0) AS reach
      FROM services
      LEFT JOIN content_analytics
        ON content_analytics.content_type = 'service'
       AND content_analytics.content_id = services.id
      ORDER BY services.created_at DESC
    `);

    return res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('[Services] GET failed:', error.message);
    return res.status(500).json({
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

    const createdService = result.rows[0];
    contentCache.clearPrefix('services:');
    contentCache.clearPrefix('analytics:');

    if (createdService.published) {
      void sendContentPush({
        type: 'service',
        id: createdService.id,
        title: createdService.title,
      }).then((delivery) => {
        console.log('[Push] Service notification sent:', delivery);
      }).catch((pushError) => {
        console.error('[Push] Service notification failed:', pushError.message);
      });
    }

    res.status(201).json({
      success: true,
      data: createdService,
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

    const existing = await db.query(
      'SELECT published FROM services WHERE id = $1',
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Service not found.',
      });
    }

    const wasPublished = Boolean(existing.rows[0].published);

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

    const updatedService = result.rows[0];
    contentCache.clearPrefix('services:');
    contentCache.clearPrefix('analytics:');

    if (!wasPublished && updatedService.published) {
      void sendContentPush({
        type: 'service',
        id: updatedService.id,
        title: updatedService.title,
      }).then((delivery) => {
        console.log('[Push] Service notification sent:', delivery);
      }).catch((pushError) => {
        console.error('[Push] Service notification failed:', pushError.message);
      });
    }

    res.json({
      success: true,
      data: updatedService,
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

    await deleteAnalyticsForContent('service', result.rows[0].id);
    contentCache.clearPrefix('services:');
    contentCache.clearPrefix('analytics:');

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

function mapExchangeProvider(row) {
  return {
    id: String(row.id),
    countryCode: row.countryCode ?? row.country_code ?? 'MY',
    baseCurrency: row.baseCurrency ?? row.base_currency ?? 'MYR',
    name: row.name,
    rate: row.rate,
    logoUrl: row.logoUrl ?? row.logo_url ?? '',
    websiteUrl: row.websiteUrl ?? row.website_url ?? '',
    published: Boolean(row.published),
    displayOrder: Number(row.displayOrder ?? row.display_order ?? 0),
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
  };
}

const EXCHANGE_MARKETS = {
  MY: { countryCode: 'MY', baseCurrency: 'MYR', countryName: 'Malaysia' },
  SG: { countryCode: 'SG', baseCurrency: 'SGD', countryName: 'Singapore' },
  TH: { countryCode: 'TH', baseCurrency: 'THB', countryName: 'Thailand' },
};

function normalizeExchangeCountry(value) {
  const countryCode = String(value || 'MY').trim().toUpperCase();
  return EXCHANGE_MARKETS[countryCode] ? countryCode : 'MY';
}

async function getExchangeProviders(includeUnpublished = false, country = 'MY') {
  const countryCode = normalizeExchangeCountry(country);
  const params = [countryCode];
  const visibilityClause = includeUnpublished ? '' : 'AND published = TRUE';
  const result = await db.query(`
    SELECT
      id,
      country_code AS "countryCode",
      base_currency AS "baseCurrency",
      name,
      rate,
      logo_url AS "logoUrl",
      website_url AS "websiteUrl",
      published,
      display_order AS "displayOrder",
      updated_at AS "updatedAt"
    FROM exchange_provider_rates
    WHERE country_code = $1
    ${visibilityClause}
    ORDER BY display_order ASC, id ASC
    LIMIT 2
  `, params);

  return result.rows.map(mapExchangeProvider);
}

async function getExchangeRate(includeUnpublishedProviders = false, country = 'MY') {
  const countryCode = normalizeExchangeCountry(country);
  const market = EXCHANGE_MARKETS[countryCode];
  const [result, providers] = await Promise.all([
    db.query(`
      SELECT
        id,
        country_code AS "countryCode",
        base_currency AS "baseCurrency",
        rate,
        updated_at AS "updatedAt"
      FROM exchange_rates
      WHERE country_code = $1
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `, [countryCode]),
    getExchangeProviders(includeUnpublishedProviders, countryCode),
  ]);

  return {
    ...(result.rows[0] || {
      id: null,
      countryCode,
      baseCurrency: market.baseCurrency,
      rate: null,
      updatedAt: null,
    }),
    countryName: market.countryName,
    providers,
  };
}

async function exchangeProviderFileUrl(file) {
  return file ? r2Media.uploadFile(file, 'exchange-providers') : '';
}

async function removeStoredExchangeProviderLogo(mediaPath) {
  try {
    await r2Media.deleteFile(mediaPath);
  } catch (error) {
    console.error('[Exchange] Provider logo cleanup failed:', error.message);
  }
}

function validateExchangeProvider(body, current = {}) {
  const countryCode = normalizeExchangeCountry(body.countryCode ?? current.country_code ?? 'MY');
  const market = EXCHANGE_MARKETS[countryCode];
  const name = boundedText(body.name ?? current.name, 80, 'Provider name');
  const rateText = String(body.rate ?? current.rate ?? '').trim().replace(/,/g, '');
  const websiteUrl = boundedText(body.websiteUrl ?? current.website_url ?? '', 2048, 'Website URL');
  const displayOrder = Number(body.displayOrder ?? current.display_order ?? 0);

  if (!name) {
    const error = new Error('Provider name is required.');
    error.statusCode = 400;
    throw error;
  }
  if (!/^\d+(?:\.\d+)?$/.test(rateText) || !Number.isFinite(Number(rateText)) || Number(rateText) <= 0) {
    const error = new Error('Provider rate must be a number greater than zero.');
    error.statusCode = 400;
    throw error;
  }
  if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100) {
    const error = new Error('Display order must be a whole number between 0 and 100.');
    error.statusCode = 400;
    throw error;
  }
  if (websiteUrl) {
    try {
      const parsedUrl = new URL(websiteUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Unsupported protocol.');
    } catch {
      const error = new Error('Website URL must be a valid HTTP or HTTPS URL.');
      error.statusCode = 400;
      throw error;
    }
  }

  return {
    countryCode,
    baseCurrency: market.baseCurrency,
    name,
    rate: Number(rateText),
    websiteUrl,
    displayOrder,
    published: parseBoolean(body.published, current.published ?? true),
  };
}

async function saveExchangeRate(req, res) {
  try {
    const body = req.body || {};
    const countryCode = normalizeExchangeCountry(body.countryCode);
    const market = EXCHANGE_MARKETS[countryCode];
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

    const previousResult = await db.query(
      `SELECT rate
         FROM exchange_rates
        WHERE country_code = $1
        ORDER BY updated_at DESC, id DESC
        LIMIT 1`,
      [countryCode],
    );
    const previousRate =
      previousResult.rows.length > 0 ? Number(previousResult.rows[0].rate) : null;

    const result = await db.query(
      `INSERT INTO exchange_rates (country_code, base_currency, rate, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING
         id,
         country_code AS "countryCode",
         base_currency AS "baseCurrency",
         rate,
         updated_at AS "updatedAt"`,
      [countryCode, market.baseCurrency, numericRate],
    );

    const savedRate = Number(result.rows[0].rate);
    contentCache.clearPrefix('exchange:');
    if (
      previousRate !== null &&
      Number.isFinite(previousRate) &&
      previousRate !== savedRate
    ) {
      void sendContentPush({
        type: 'exchange',
        rate: savedRate,
        currency: market.baseCurrency,
        countryCode,
      }).then((delivery) => {
        console.log('[Push] Exchange rate notification sent:', delivery);
      }).catch((pushError) => {
        console.error('[Push] Exchange rate notification failed:', pushError.message);
      });
    }

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
    const isAdmin = isAdminAuthenticated(req);
    const countryCode = normalizeExchangeCountry(req.query.country);
    const cacheKey = `exchange:public:${countryCode}`;
    const exchange = isAdmin
      ? await getExchangeRate(true, countryCode)
      : await contentCache.getOrLoad(
          cacheKey,
          EXCHANGE_CACHE_TTL_MS,
          () => getExchangeRate(false, countryCode),
        );

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
    const isAdmin = isAdminAuthenticated(req);
    const exchange = isAdmin
      ? await getExchangeRate(true)
      : await contentCache.getOrLoad(
          'exchange:public',
          EXCHANGE_CACHE_TTL_MS,
          () => getExchangeRate(false),
        );

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

app.post('/api/exchange-providers', exchangeProviderUploadMiddleware, async (req, res) => {
  try {
    const provider = validateExchangeProvider(req.body || {});
    const countResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM exchange_provider_rates WHERE country_code = $1',
      [provider.countryCode],
    );
    if (countResult.rows[0].count >= 2) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(409).json({
        success: false,
        message: 'A maximum of two comparison providers is allowed.',
      });
    }

    const logoUrl = await exchangeProviderFileUrl(req.file);
    const result = await db.query(
      `INSERT INTO exchange_provider_rates
        (country_code, base_currency, name, rate, logo_url, website_url, published, display_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING
         id,
         country_code AS "countryCode",
         base_currency AS "baseCurrency",
         name,
         rate,
         logo_url AS "logoUrl",
         website_url AS "websiteUrl",
         published,
         display_order AS "displayOrder",
         updated_at AS "updatedAt"`,
      [
        provider.countryCode,
        provider.baseCurrency,
        provider.name,
        provider.rate,
        logoUrl,
        provider.websiteUrl,
        provider.published,
        provider.displayOrder,
      ],
    );

    contentCache.clearPrefix('exchange:');
    return res.status(201).json({ success: true, data: mapExchangeProvider(result.rows[0]) });
  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Best-effort cleanup.
      }
    }
    console.error('[Exchange] Provider create failed:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to create comparison provider.',
    });
  }
});

app.put('/api/exchange-providers/:id', exchangeProviderUploadMiddleware, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT * FROM exchange_provider_rates WHERE id = $1',
      [String(req.params.id)],
    );
    if (existing.rows.length === 0) {
      if (req.file?.path) fs.unlinkSync(req.file.path);
      return res.status(404).json({ success: false, message: 'Comparison provider not found.' });
    }

    const current = existing.rows[0];
    const provider = validateExchangeProvider(req.body || {}, current);
    const removeLogo = parseBoolean(req.body?.removeLogo, false);
    const nextLogoUrl = req.file
      ? await exchangeProviderFileUrl(req.file)
      : removeLogo
        ? ''
        : current.logo_url;

    const result = await db.query(
      `UPDATE exchange_provider_rates
       SET country_code = $1,
           base_currency = $2,
           name = $3,
           rate = $4,
           logo_url = $5,
           website_url = $6,
           published = $7,
           display_order = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING
         id,
         country_code AS "countryCode",
         base_currency AS "baseCurrency",
         name,
         rate,
         logo_url AS "logoUrl",
         website_url AS "websiteUrl",
         published,
         display_order AS "displayOrder",
         updated_at AS "updatedAt"`,
      [
        provider.countryCode,
        provider.baseCurrency,
        provider.name,
        provider.rate,
        nextLogoUrl,
        provider.websiteUrl,
        provider.published,
        provider.displayOrder,
        String(req.params.id),
      ],
    );

    if ((req.file || removeLogo) && current.logo_url !== nextLogoUrl) {
      await removeStoredExchangeProviderLogo(current.logo_url);
    }

    contentCache.clearPrefix('exchange:');
    return res.json({ success: true, data: mapExchangeProvider(result.rows[0]) });
  } catch (error) {
    if (req.file?.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        // Best-effort cleanup.
      }
    }
    console.error('[Exchange] Provider update failed:', error.message);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Failed to update comparison provider.',
    });
  }
});

app.delete('/api/exchange-providers/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM exchange_provider_rates WHERE id = $1 RETURNING id, logo_url',
      [String(req.params.id)],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Comparison provider not found.' });
    }
    await removeStoredExchangeProviderLogo(result.rows[0].logo_url);
    contentCache.clearPrefix('exchange:');
    return res.json({ success: true, data: { id: String(result.rows[0].id) } });
  } catch (error) {
    console.error('[Exchange] Provider delete failed:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete comparison provider.',
    });
  }
});

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
  if (!/^\d{1,3}$/.test(ageText) || !Number.isInteger(age) || age < 18 || age > 120) {
    return { error: 'You must be 18 or older to use a Sagawa account.' };
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

    if (/^https:\/\//i.test(storedPath)) {
      res.setHeader('Cache-Control', 'private, no-store');
      return res.redirect(302, storedPath);
    }

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
    scheduleUserSheetSync(req.mobileUser.id, { platform: req.body?.platform || 'Mobile', force: true });
    return res.json({ success: true, data: profilePayload(result.rows[0]) });
  } catch (error) {
    console.error('[Profile] Save failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to save profile.' });
  }
});

app.post('/api/profile/image', requireMobileUser, profileUploadMiddleware, async (req, res) => {
  let uploadedProfileImage = '';
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No profile image was uploaded.',
      });
    }

    const usePersistentProfileStorage = r2Media.isConfigured();
    uploadedProfileImage = usePersistentProfileStorage
      ? await r2Media.uploadFile(req.file, 'profiles')
      : `/uploads/profile/${req.file.filename}`;
    const profileImage = uploadedProfileImage;

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
      if (/^https:\/\//i.test(uploadedProfileImage)) {
        await r2Media.deleteFile(uploadedProfileImage).catch(() => {});
      } else if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({
        success: false,
        message: 'Profile not found.',
      });
    }

    const previousImage = String(currentProfile?.profileImage || '');
    if (/^https:\/\//i.test(previousImage)) {
      await r2Media.deleteFile(previousImage).catch((cleanupError) => {
        console.error('[Profile] Previous R2 image cleanup failed:', cleanupError.message);
      });
    } else if (previousImage.startsWith('/uploads/profile/')) {
      const previousPath = path.join(profileUploadDir, path.basename(previousImage));
      if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
    }

    return res.json({
      success: true,
      data: profilePayload(result.rows[0]),
      message: 'Profile image uploaded successfully.',
    });
  } catch (error) {
    if (/^https:\/\//i.test(uploadedProfileImage)) {
      await r2Media.deleteFile(uploadedProfileImage).catch(() => {});
    }
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

app.post('/api/support', supportLimiter, (req, res) => {
  try {
    const body = req.body || {};
    const name = boundedText(body.name, 100, 'Name');
    const contact = boundedText(body.contact, 200, 'Contact');
    const text = boundedText(body.message, 2000, 'Support message');

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Support message is required.',
      });
    }

    const message = {
      id: crypto.randomUUID(),
      name,
      contact,
      message: text,
      createdAt: new Date().toISOString(),
    };

    const stored = readJson(supportFile, []);
    const messages = Array.isArray(stored) ? stored : [];
    messages.unshift(message);

    // Bound local storage growth. Keep only the newest 500 records.
    writeJson(supportFile, messages.slice(0, 500));

    return res.status(201).json({
      success: true,
      data: { id: message.id, createdAt: message.createdAt },
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) console.error('[Support] Submit failed:', error.message);
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to send support message.' : error.message,
    });
  }
});

app.post('/api/notifications/register-token', requireMobileUser, async (req, res) => {
  try {
    const record = await savePushToken(req.body?.token, req.body?.platform);
    return res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    const status = Number(error.statusCode) || 500;
    if (status >= 500) {
      console.error('[Push] Token registration failed:', error.message);
    }
    return res.status(status).json({
      success: false,
      message: status >= 500 ? 'Unable to register notifications.' : error.message,
    });
  }
});

app.post('/api/notifications/unregister-token', requireMobileUser, async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) return res.status(400).json({ success: false, message: 'Push token is required.' });
    await removePushTokens([token]);
    return res.json({ success: true });
  } catch (error) {
    console.error('[Push] Token removal failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to disable notifications.' });
  }
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
    const sheetsSyncEnabled = /^(1|true|yes)$/i.test(String(process.env.GOOGLE_SHEETS_SYNC_ENABLED || ''));
    console.log(`[SheetsSync] Enabled: ${sheetsSyncEnabled ? 'yes' : 'no'}`);
    if (sheetsSyncEnabled) {
      verifySheetAccess()
        .then(() => console.log('[SheetsSync] Access verified.'))
        .catch((error) => console.error('[SheetsSync] Access check failed:', error.message));
    }
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

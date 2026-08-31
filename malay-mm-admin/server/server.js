// server.js

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const {
  ADMIN_ORIGIN,
  beginAuthentication,
  beginRegistration,
  clearSessionCookie,
  createSession,
  destroySession,
  finishAuthentication,
  finishRegistration,
  isAdminAuthenticated,
  login,
  requireAdmin,
  replaceAdminPasswordHash,
  setSessionCookie,
  validatePasswordPolicy,
  verifyPassword,
} = require('./auth');

const app = express();

const PORT = Number(process.env.API_PORT || process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const configuredCorsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = configuredCorsOrigins.length ? configuredCorsOrigins : [ADMIN_ORIGIN];

if (!allowedCorsOrigins.length || !allowedCorsOrigins.every(Boolean)) {
  throw new Error('CORS_ORIGIN or ADMIN_ORIGIN must be set to a trusted browser origin before starting the server.');
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
    return callback(new Error('Origin is not allowed by CORS.'));
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
  limit: 8,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Try again later.',
  },
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json({ limit: '20mb' }));
app.use(
  express.urlencoded({
    extended: true,
    limit: '20mb',
  }),
);

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim();
  const password = req.body?.password;
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !emailPattern.test(email) || typeof password !== 'string' || password.length < 1) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' });
  }

  try {
    if (!(await login(email, password))) {
      console.error('[Auth] Password login rejected for configured admin account.');
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    setSessionCookie(res, createSession());
    console.log('[Auth] Password login succeeded.');
    return res.json({ success: true, data: { authenticated: true } });
  } catch (error) {
    console.error('[Auth] Password login failed:', error.message);
    return res.status(500).json({ success: false, message: 'Authentication service unavailable.' });
  }
});

app.get('/api/auth/me', (req, res) => {
  res.json({ success: true, data: { authenticated: isAdminAuthenticated(req) } });
});

app.post('/api/auth/change-password', requireAdmin, async (req, res) => {
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const confirmPassword = typeof req.body?.confirmPassword === 'string' ? req.body.confirmPassword : '';

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({ success: false, message: 'Current password, new password, and confirmation are required.' });
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
    sessions.clear();
    clearSessionCookie(res);

    return res.json({ success: true, message: 'Password updated successfully. Please sign in again.' });
  } catch (error) {
    console.error('[Auth] Change password failed:', error.message);
    return res.status(500).json({ success: false, message: 'Password change failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req);
  clearSessionCookie(res);
  res.json({ success: true });
});

app.post('/api/auth/passkey/authentication-options', authLimiter, (req, res) => {
  try {
    return res.json({ success: true, data: beginAuthentication() });
  } catch (error) {
    console.error('[Auth] Passkey options failed:', error.message);
    return res.status(400).json({ success: false, message: 'Passkey authentication is unavailable.' });
  }
});

app.post('/api/auth/passkey/authentication', authLimiter, async (req, res) => {
  try {
    await finishAuthentication(req.body);
    setSessionCookie(res, createSession());
    console.log('[Auth] Passkey login succeeded.');
    return res.json({ success: true, data: { authenticated: true } });
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
    return res.status(400).json({ success: false, message: 'Passkey registration is unavailable.' });
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
  if (req.method === 'GET') return next();
  return requireAdmin(req, res, next);
});

const dataDir = path.join(__dirname, 'data');

const newsFile = path.join(
  dataDir,
  'news.json',
);

const servicesFile = path.join(
  dataDir,
  'services.json',
);

const exchangeFile = path.join(
  dataDir,
  'exchange.json',
);

const profileFile = path.join(
  dataDir,
  'profile.json',
);

const supportFile = path.join(
  dataDir,
  'support.json',
);

const notificationTokensFile = path.join(
  dataDir,
  'notification-tokens.json',
);

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, {
    recursive: true,
  });
}

function createFileIfMissing(
  file,
  defaultValue,
) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(
      file,
      JSON.stringify(
        defaultValue,
        null,
        2,
      ),
      'utf8',
    );
  }
}

function readJson(file, fallback) {
  try {
    const content = fs.readFileSync(
      file,
      'utf8',
    );

    if (!content.trim()) {
      return fallback;
    }

    return JSON.parse(content);
  } catch (error) {
    console.error(
      `Failed to read ${file}:`,
      error.message,
    );

    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
    'utf8',
  );
}

createFileIfMissing(
  newsFile,
  [],
);

createFileIfMissing(
  servicesFile,
  [],
);

createFileIfMissing(
  exchangeFile,
  {
    rate: '1053',
    updatedAt:
      new Date().toISOString(),
  },
);

createFileIfMissing(
  profileFile,
  {
    name: 'Your Profile',
    phoneNumber: '',
    address: '',
    profileImage: '',
    updatedAt:
      new Date().toISOString(),
  },
);

createFileIfMissing(
  supportFile,
  [],
);

createFileIfMissing(
  notificationTokensFile,
  [],
);

function normalizeExchange() {
  const current = readJson(
    exchangeFile,
    null,
  );

  if (
    !current ||
    typeof current !== 'object'
  ) {
    const freshExchange = {
      rate: '1053',
      updatedAt:
        new Date().toISOString(),
    };

    writeJson(
      exchangeFile,
      freshExchange,
    );

    return freshExchange;
  }

  if (
    current.rate !== undefined &&
    current.rate !== null &&
    String(current.rate).trim() !== ''
  ) {
    const rate = String(
      current.rate,
    )
      .replace(/,/g, '')
      .trim();

    const numericRate = Number(rate);

    if (
      Number.isFinite(numericRate) &&
      numericRate > 0
    ) {
      const normalized = {
        rate,
        updatedAt:
          current.updatedAt ||
          new Date().toISOString(),
      };

      writeJson(
        exchangeFile,
        normalized,
      );

      return normalized;
    }
  }

  if (Array.isArray(current.rates)) {
    const myrRate =
      current.rates.find(
        (item) =>
          String(
            item?.currency || '',
          )
            .toUpperCase()
            .includes('MYR'),
      );

    const oldRate =
      myrRate?.buy ||
      myrRate?.rate ||
      '1053';

    const rate = String(
      oldRate,
    )
      .replace(/,/g, '')
      .trim();

    const numericRate = Number(rate);

    if (
      Number.isFinite(numericRate) &&
      numericRate > 0
    ) {
      const normalized = {
        rate,
        updatedAt:
          current.updatedAt ||
          new Date().toISOString(),
      };

      writeJson(
        exchangeFile,
        normalized,
      );

      return normalized;
    }
  }

  const fallback = {
    rate: '1053',
    updatedAt:
      new Date().toISOString(),
  };

  writeJson(
    exchangeFile,
    fallback,
  );

  return fallback;
}

function readProfile() {
  const profile = readJson(
    profileFile,
    null,
  );

  if (
    profile &&
    typeof profile === 'object'
  ) {
    return {
      name:
        String(
          profile.name ||
            'Your Profile',
        ).trim(),
      phoneNumber:
        String(
          profile.phoneNumber || '',
        ).trim(),
      address:
        String(
          profile.address || '',
        ).trim(),
      profileImage:
        String(
          profile.profileImage || '',
        ).trim(),
      updatedAt:
        profile.updatedAt ||
        new Date().toISOString(),
    };
  }

  const fallback = {
    name: 'Your Profile',
    phoneNumber: '',
    address: '',
    profileImage: '',
    updatedAt:
      new Date().toISOString(),
  };

  writeJson(
    profileFile,
    fallback,
  );

  return fallback;
}

normalizeExchange();

app.get('/', (req, res) => {
  res.json({
    success: true,
    message:
      'Sagawa Local API is running',
    endpoints: {
      news: '/api/news',
      services: '/api/services',
      exchange: '/api/exchange',
      exchangeRate:
        '/api/exchange-rate',
      profile: '/api/profile',
      support: '/api/support',
    },
  });
});

app.get('/api/news', (req, res) => {
  const news = readJson(
    newsFile,
    [],
  );

  res.json({
    success: true,
    data: news,
  });
});

app.post('/api/news', (req, res) => {
  const news = readJson(
    newsFile,
    [],
  );

  const {
    title,
    description = '',
    image = '',
    video = '',
    published = true,
    ...extra
  } = req.body || {};

  if (
    !title ||
    !String(title).trim()
  ) {
    return res.status(400).json({
      success: false,
      message:
        'Title is required.',
    });
  }

  const newNews = {
    id: Date.now(),
    title: String(title).trim(),
    description: String(
      description || '',
    ).trim(),
    image: image || '',
    video: video || '',
    published: Boolean(
      published,
    ),
    date:
      new Date().toLocaleDateString(
        'en-GB',
        {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        },
      ),
    ...extra,
  };

  news.unshift(newNews);

  writeJson(
    newsFile,
    news,
  );

  res.status(201).json({
    success: true,
    data: newNews,
  });
});

app.put(
  '/api/news/:id',
  (req, res) => {
    const news = readJson(
      newsFile,
      [],
    );

    const id = Number(
      req.params.id,
    );

    const index =
      news.findIndex(
        (item) =>
          Number(item.id) === id,
      );

    if (index === -1) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            'News not found.',
        });
    }

    news[index] = {
      ...news[index],
      ...req.body,
      id: news[index].id,
    };

    writeJson(
      newsFile,
      news,
    );

    res.json({
      success: true,
      data: news[index],
    });
  },
);

app.delete(
  '/api/news/:id',
  (req, res) => {
    const news = readJson(
      newsFile,
      [],
    );

    const id = Number(
      req.params.id,
    );

    const filtered =
      news.filter(
        (item) =>
          Number(item.id) !== id,
      );

    if (
      filtered.length ===
      news.length
    ) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            'News not found.',
        });
    }

    writeJson(
      newsFile,
      filtered,
    );

    res.json({
      success: true,
      message:
        'News deleted successfully.',
    });
  },
);

app.get(
  '/api/services',
  (req, res) => {
    const services = readJson(
      servicesFile,
      [],
    );

    res.json({
      success: true,
      data: services,
    });
  },
);

app.post(
  '/api/services',
  (req, res) => {
    const services = readJson(
      servicesFile,
      [],
    );

    const body =
      req.body || {};

    if (
      !body.title ||
      !String(body.title).trim()
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Service title is required.',
        });
    }

    const service = {
      id:
        body.id ||
        Date.now().toString(),

      title:
        String(
          body.title,
        ).trim(),

      description:
        body.description !==
        undefined
          ? String(
              body.description,
            )
          : '',

      image:
        body.image || '',

      icon:
        body.icon ||
        'grid-outline',

      details:
        body.details || '',

      contact:
        body.contact || '',

      location:
        body.location || '',

      openingHours:
        body.openingHours || '',

      website:
        body.website || '',

      published:
        body.published !==
        undefined
          ? Boolean(
              body.published,
            )
          : true,

      date:
        body.date ||
        new Date().toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          },
        ),

      ...body,
    };

    services.unshift(service);

    writeJson(
      servicesFile,
      services,
    );

    res.status(201).json({
      success: true,
      data: service,
    });
  },
);

app.put(
  '/api/services/:id',
  (req, res) => {
    const services =
      readJson(
        servicesFile,
        [],
      );

    const id = String(
      req.params.id,
    );

    const index =
      services.findIndex(
        (item) =>
          String(item.id) ===
          id,
      );

    if (index === -1) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            'Service not found.',
        });
    }

    services[index] = {
      ...services[index],
      ...req.body,
      id: services[index].id,
    };

    writeJson(
      servicesFile,
      services,
    );

    res.json({
      success: true,
      data: services[index],
    });
  },
);

app.delete(
  '/api/services/:id',
  (req, res) => {
    const services =
      readJson(
        servicesFile,
        [],
      );

    const id = String(
      req.params.id,
    );

    const filtered =
      services.filter(
        (item) =>
          String(item.id) !==
          id,
      );

    if (
      filtered.length ===
      services.length
    ) {
      return res
        .status(404)
        .json({
          success: false,
          message:
            'Service not found.',
        });
    }

    writeJson(
      servicesFile,
      filtered,
    );

    res.json({
      success: true,
      message:
        'Service deleted successfully.',
    });
  },
);

app.get(
  '/api/exchange',
  (req, res) => {
    const exchange =
      normalizeExchange();

    res.json({
      success: true,
      data: exchange,
    });
  },
);

app.get(
  '/api/exchange-rate',
  (req, res) => {
    const exchange =
      normalizeExchange();

    res.json({
      success: true,
      data: exchange,
    });
  },
);

function saveExchangeRate(
  req,
  res,
) {
  const body =
    req.body || {};

  const rate = String(
    body.rate ?? '',
  ).trim();

  console.log('[Exchange] Save requested:', {
    method: req.method,
    path: req.originalUrl,
    rate,
  });

  if (!rate) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          'Exchange rate is required.',
      });
  }

  const cleanRate =
    rate.replace(
      /,/g,
      '',
    );

  if (
    !/^\d+(?:\.\d+)?$/.test(
      cleanRate,
    )
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          'Exchange rate must be a valid number.',
      });
  }

  const numericRate =
    Number(cleanRate);

  if (
    !Number.isFinite(
      numericRate,
    ) ||
    numericRate <= 0
  ) {
    return res
      .status(400)
      .json({
        success: false,
        message:
          'Exchange rate must be greater than zero.',
      });
  }

  const exchange = {
    rate: cleanRate,
    updatedAt:
      new Date().toISOString(),
  };

  writeJson(
    exchangeFile,
    exchange,
  );

  console.log('[Exchange] Saved:', exchange);

  res.json({
    success: true,
    data: exchange,
  });
}

app.post(
  '/api/exchange',
  saveExchangeRate,
);

app.put(
  '/api/exchange',
  saveExchangeRate,
);

app.post(
  '/api/exchange-rate',
  saveExchangeRate,
);

app.put(
  '/api/exchange-rate',
  saveExchangeRate,
);

app.get(
  '/api/profile',
  (req, res) => {
    const profile =
      readProfile();

    res.json({
      success: true,
      data: profile,
    });
  },
);

app.put(
  '/api/profile',
  (req, res) => {
    const current =
      readProfile();

    const body =
      req.body || {};

    const nextProfile = {
      ...current,
      name:
        String(
          body.name ??
            current.name,
        ).trim() ||
        current.name,
      phoneNumber:
        String(
          body.phoneNumber ??
            current.phoneNumber,
        ).trim(),
      address:
        String(
          body.address ??
            current.address,
        ).trim(),
      updatedAt:
        new Date().toISOString(),
    };

    writeJson(
      profileFile,
      nextProfile,
    );

    res.json({
      success: true,
      data: nextProfile,
    });
  },
);

app.post(
  '/api/profile/image',
  (req, res) => {
    const current =
      readProfile();

    const nextProfile = {
      ...current,
      updatedAt:
        new Date().toISOString(),
    };

    writeJson(
      profileFile,
      nextProfile,
    );

    res.json({
      success: true,
      data: nextProfile,
      message:
        'Profile image upload acknowledged.',
    });
  },
);

app.post(
  '/api/support',
  (req, res) => {
    const body =
      req.body || {};

    const message = {
      id: Date.now(),
      name:
        String(
          body.name || '',
        ).trim(),
      contact:
        String(
          body.contact || '',
        ).trim(),
      message:
        String(
          body.message || '',
        ).trim(),
      createdAt:
        new Date().toISOString(),
    };

    if (!message.message) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Support message is required.',
        });
    }

    const messages = readJson(
      supportFile,
      [],
    );

    messages.unshift(message);

    writeJson(
      supportFile,
      messages,
    );

    res.status(201).json({
      success: true,
      data: message,
    });
  },
);

app.post(
  '/api/notifications/register-token',
  (req, res) => {
    const body =
      req.body || {};

    const token = String(
      body.token || '',
    ).trim();

    if (!token) {
      return res
        .status(400)
        .json({
          success: false,
          message:
            'Notification token is required.',
        });
    }

    const tokens = readJson(
      notificationTokensFile,
      [],
    );

    const record = {
      token,
      platform:
        String(
          body.platform ||
            'unknown',
        ).trim(),
      updatedAt:
        new Date().toISOString(),
    };

    const nextTokens =
      Array.isArray(tokens)
        ? tokens.filter(
            (item) =>
              item?.token !==
              token,
          )
        : [];

    nextTokens.unshift(record);

    writeJson(
      notificationTokensFile,
      nextTokens,
    );

    res.status(201).json({
      success: true,
      data: record,
    });
  },
);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message:
      `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use(
  (error, req, res, _next) => {
    console.error(
      'API Error:',
      error,
    );

    res.status(500).json({
      success: false,
      message:
        'Internal server error.',
    });
  },
);

const server = app.listen(
  PORT,
  HOST,
  () => {
    console.log(
      '==========================================',
    );
    console.log(
      '       MALAY MM LOCAL API SERVER',
    );
    console.log(
      '==========================================',
    );
    console.log(
      `Listening on ${HOST}:${PORT}`,
    );
    console.log(
      `CORS origins: ${allowedCorsOrigins.join(', ')}`,
    );
    console.log(
      '==========================================',
    );
  },
);

server.on('error', (error) => {
  console.error(
    'Server failed to start:',
    error,
  );
});

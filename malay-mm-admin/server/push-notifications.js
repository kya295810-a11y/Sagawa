const db = require('./db');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_PATTERN = /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$/;
const MAX_BATCH_SIZE = 100;

function isExpoPushToken(value) {
  return EXPO_TOKEN_PATTERN.test(String(value || '').trim());
}

async function savePushToken(token, platform) {
  const cleanToken = String(token || '').trim();
  const cleanPlatform = String(platform || '').trim().toLowerCase();

  if (!isExpoPushToken(cleanToken)) {
    const error = new Error('Invalid Expo push token.');
    error.statusCode = 400;
    throw error;
  }

  if (!['android', 'ios'].includes(cleanPlatform)) {
    const error = new Error('Notification platform must be android or ios.');
    error.statusCode = 400;
    throw error;
  }

  const result = await db.query(
    `INSERT INTO notification_tokens (token, platform, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (token)
     DO UPDATE SET platform = EXCLUDED.platform, updated_at = NOW()
     RETURNING token, platform, updated_at AS "updatedAt"`,
    [cleanToken, cleanPlatform],
  );

  return result.rows[0];
}

async function removePushTokens(tokens) {
  const cleanTokens = Array.from(new Set(tokens.filter(Boolean)));
  if (!cleanTokens.length) return;
  await db.query('DELETE FROM notification_tokens WHERE token = ANY($1::text[])', [cleanTokens]);
}

async function getPushTokens() {
  const result = await db.query(
    `SELECT token, platform
       FROM notification_tokens
      ORDER BY updated_at DESC`,
  );
  return result.rows.filter((row) => isExpoPushToken(row.token));
}

function chunk(values, size) {
  const chunks = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function sendExpoBatch(messages) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
        ...(process.env.EXPO_ACCESS_TOKEN
          ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(messages),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        `Expo push service returned ${response.status}: ${JSON.stringify(payload)?.slice(0, 500)}`,
      );
    }

    return Array.isArray(payload?.data) ? payload.data : [];
  } finally {
    clearTimeout(timeout);
  }
}

async function sendContentPush({ type, id, title }) {
  if (!['news', 'service'].includes(type)) {
    throw new Error('Unsupported push content type.');
  }

  const rows = await getPushTokens();
  if (!rows.length) {
    return { attempted: 0, sent: 0, removed: 0 };
  }

  const cleanTitle = String(title || '').trim().slice(0, 160);
  const notificationTitle = type === 'news' ? 'New Sagawa News' : 'New Sagawa Service';
  const body =
    cleanTitle ||
    (type === 'news'
      ? 'A new news update is available in Sagawa.'
      : 'A new service is available in Sagawa.');

  let sent = 0;
  const staleTokens = [];

  for (const batch of chunk(rows, MAX_BATCH_SIZE)) {
    const messages = batch.map(({ token }) => ({
      to: token,
      sound: 'default',
      title: notificationTitle,
      body,
      priority: 'high',
      channelId: 'default',
      data:
        type === 'news'
          ? { type: 'news', newsId: String(id) }
          : { type: 'service', serviceId: String(id) },
    }));

    const tickets = await sendExpoBatch(messages);

    tickets.forEach((ticket, index) => {
      if (ticket?.status === 'ok') {
        sent += 1;
        return;
      }

      const errorCode = ticket?.details?.error;
      if (errorCode === 'DeviceNotRegistered') {
        staleTokens.push(batch[index]?.token);
      } else if (ticket?.message || errorCode) {
        console.warn('[Push] Expo rejected notification:', ticket?.message || errorCode);
      }
    });
  }

  if (staleTokens.length) {
    await removePushTokens(staleTokens);
  }

  return {
    attempted: rows.length,
    sent,
    removed: staleTokens.length,
  };
}

module.exports = {
  isExpoPushToken,
  savePushToken,
  sendContentPush,
};

const TWILIO_ACCOUNT_SID = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
const TWILIO_AUTH_TOKEN = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
const TWILIO_FROM_NUMBER = String(process.env.TWILIO_FROM_NUMBER || '').trim();

function isSmsConfigured() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && /^\+\d{8,15}$/.test(TWILIO_FROM_NUMBER));
}

async function sendVerificationSms(toPhone, code) {
  if (!isSmsConfigured()) {
    const error = new Error('Phone verification is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const body = new URLSearchParams({
    From: TWILIO_FROM_NUMBER,
    To: toPhone,
    Body: `Your Sagawa verification code is ${code}. It expires in 10 minutes. Do not share this code.`,
  });

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(TWILIO_ACCOUNT_SID)}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: controller.signal,
      },
    );
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        message = JSON.parse(text)?.message || text;
      } catch {}
      throw new Error(`SMS provider returned ${response.status}: ${message || 'Unknown error'}`);
    }
    return true;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('SMS provider request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { isSmsConfigured, sendVerificationSms };

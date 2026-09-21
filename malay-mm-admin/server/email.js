const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || '').trim();

function isEmailConfigured() {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

async function sendEmail({ to, subject, html, text }) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      let detail = responseText;
      try {
        const parsed = JSON.parse(responseText);
        detail = parsed?.message || parsed?.error || responseText;
      } catch {
        // Keep the raw response text when Resend does not return JSON.
      }

      throw new Error(`Resend API returned ${response.status}: ${detail || 'Unknown error'}`);
    }

    return true;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Resend API request timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendVerificationCode(toEmail, code) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const expirationMinutes = 5;
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; border-radius: 4px 4px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 4px 4px; }
          .code-box { background: white; border: 2px solid #2c3e50; padding: 15px; text-align: center; margin: 20px 0; border-radius: 4px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2c3e50; }
          .warning { background: #fff3cd; border: 1px solid #ffc107; color: #856404; padding: 12px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Sagawa Admin</h1>
            <p>Email Verification</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>You requested to sign in to the Sagawa Admin dashboard. Use the verification code below to complete your login:</p>
            <div class="code-box">
              <div class="code">${code}</div>
              <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Valid for ${expirationMinutes} minutes</p>
            </div>
            <div class="warning">
              <strong>Security Notice:</strong> If you did not request this code, please ignore this email and secure your account. Never share this code with anyone.
            </div>
            <p style="color: #666; font-size: 12px;">This code will expire in ${expirationMinutes} minutes. Do not share it with anyone.</p>
          </div>
          <div class="footer">
            <p>&copy; Sagawa Admin. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
Sagawa Admin Email Verification

You requested to sign in to the Sagawa Admin dashboard. Use the verification code below to complete your login:

${code}

Valid for ${expirationMinutes} minutes

SECURITY NOTICE: If you did not request this code, please ignore this email and secure your account. Never share this code with anyone.

This code will expire in ${expirationMinutes} minutes. Do not share it with anyone.

© Sagawa Admin. All rights reserved.
  `;

  try {
    await sendEmail({
      to: toEmail,
      subject: 'Sagawa Admin Verification Code',
      html: htmlContent,
      text: textContent,
    });

    return true;
  } catch (error) {
    console.error('[Email] Failed to send verification code:', error.message);
    throw new Error('Failed to send verification email.');
  }
}


async function sendUserVerificationCode(toEmail, code, purpose = 'signup') {
  if (!isEmailConfigured()) {
    const error = new Error('Email verification is not configured.');
    error.statusCode = 503;
    throw error;
  }

  const action = purpose === 'login' ? 'sign in to' : 'create';
  const subject = purpose === 'login' ? 'Sagawa Login Code' : 'Verify Your Sagawa Account';
  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#172033;background:#f4f9ff;padding:24px">
        <div style="max-width:520px;margin:auto;background:#fff;border-radius:18px;padding:28px;border:1px solid #e2ecf6">
          <h1 style="margin:0 0 12px;font-size:24px">Sagawa</h1>
          <p>Use this verification code to ${action} your Sagawa account:</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:18px;margin:22px 0;background:#f4f9ff;border-radius:14px">${code}</div>
          <p>This code expires in 10 minutes. Never share it with anyone.</p>
          <p style="font-size:12px;color:#667085">If you did not request this code, you can ignore this message.</p>
        </div>
      </body>
    </html>
  `;
  const text = `Sagawa verification code: ${code}\n\nThis code expires in 10 minutes. Never share it with anyone.`;

  await sendEmail({ to: toEmail, subject, html, text });
  return true;
}

async function sendPasswordResetCode(toEmail, code, options = {}) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const expirationMinutes = options.admin ? 5 : 10;
  const productName = options.admin ? 'Sagawa Admin' : 'Sagawa';
  const accountLabel = options.admin ? 'Sagawa Admin password' : 'Sagawa password';
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c3e50; color: white; padding: 20px; border-radius: 4px 4px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 4px 4px; }
          .code-box { background: white; border: 2px solid #2c3e50; padding: 15px; text-align: center; margin: 20px 0; border-radius: 4px; }
          .code { font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #2c3e50; }
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 12px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>${productName}</h1>
            <p>Password Reset Request</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your ${accountLabel}. Use the verification code below to proceed:</p>
            <div class="code-box">
              <div class="code">${code}</div>
              <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Valid for ${expirationMinutes} minutes</p>
            </div>
            <div class="warning">
              <strong>⚠️ Security Alert:</strong> If you did not request a password reset, do NOT share this code. Your account may be at risk. Change your password immediately if you suspect unauthorized access.
            </div>
            <p style="color: #666; font-size: 12px;">This code will expire in ${expirationMinutes} minutes. Do not share it with anyone. After verifying this code, you will be able to set a new password.</p>
          </div>
          <div class="footer">
            <p>&copy; Sagawa Admin. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const textContent = `
${productName} Password Reset Request

We received a request to reset your ${accountLabel}. Use the verification code below to proceed:

${code}

Valid for ${expirationMinutes} minutes

SECURITY ALERT: If you did not request a password reset, do NOT share this code. Your account may be at risk. Change your password immediately if you suspect unauthorized access.

This code will expire in ${expirationMinutes} minutes. Do not share it with anyone. After verifying this code, you will be able to set a new password.

© Sagawa Admin. All rights reserved.
  `;

  try {
    await sendEmail({
      to: toEmail,
      subject: `${productName} Password Reset Code`,
      html: htmlContent,
      text: textContent,
    });

    return true;
  } catch (error) {
    console.error('[Email] Failed to send password reset code:', error.message);
    throw new Error('Failed to send password reset email.');
  }
}

module.exports = {
  isEmailConfigured,
  sendVerificationCode,
  sendUserVerificationCode,
  sendPasswordResetCode,
};

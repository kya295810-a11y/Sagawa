const nodemailer = require('nodemailer');

const EMAIL_HOST = String(process.env.EMAIL_HOST || '').trim();
const EMAIL_PORT = Number(process.env.EMAIL_PORT || 587);
const EMAIL_SECURE = (process.env.EMAIL_SECURE || '').toLowerCase() === 'true';
const EMAIL_USER = String(process.env.EMAIL_USER || '').trim();
const EMAIL_PASSWORD = String(process.env.EMAIL_PASSWORD || '').trim();
const EMAIL_FROM = String(process.env.EMAIL_FROM || 'noreply@sagawa-admin.local').trim();

function isEmailConfigured() {
  return Boolean(EMAIL_HOST && EMAIL_USER && EMAIL_PASSWORD);
}

let transporter = null;

function createTransporter() {
  if (!isEmailConfigured()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: EMAIL_PORT,
      secure: EMAIL_SECURE,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    });
  }

  return transporter;
}

async function sendVerificationCode(toEmail, code) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const transport = createTransporter();
  if (!transport) {
    throw new Error('Email service failed to initialize.');
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
    await transport.sendMail({
      from: EMAIL_FROM,
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

async function sendPasswordResetCode(toEmail, code) {
  if (!isEmailConfigured()) {
    throw new Error('Email service is not configured.');
  }

  const transport = createTransporter();
  if (!transport) {
    throw new Error('Email service failed to initialize.');
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
          .warning { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 12px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Sagawa Admin</h1>
            <p>Password Reset Request</p>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p>We received a request to reset your Sagawa Admin password. Use the verification code below to proceed:</p>
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
Sagawa Admin Password Reset Request

We received a request to reset your Sagawa Admin password. Use the verification code below to proceed:

${code}

Valid for ${expirationMinutes} minutes

SECURITY ALERT: If you did not request a password reset, do NOT share this code. Your account may be at risk. Change your password immediately if you suspect unauthorized access.

This code will expire in ${expirationMinutes} minutes. Do not share it with anyone. After verifying this code, you will be able to set a new password.

© Sagawa Admin. All rights reserved.
  `;

  try {
    await transport.sendMail({
      from: EMAIL_FROM,
      to: toEmail,
      subject: 'Sagawa Admin Password Reset Code',
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
  sendPasswordResetCode,
};

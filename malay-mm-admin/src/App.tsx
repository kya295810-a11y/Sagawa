import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

import './App.css';
import { API_BASE, apiUrl, mediaUrl } from './config/api';


type Page = 'dashboard' | 'news' | 'services' | 'exchange' | 'analytics';

type ModalMode =
  | 'none'
  | 'newsForm'
  | 'newsPreview'
  | 'newsDelete'
  | 'serviceForm'
  | 'servicePreview'
  | 'serviceDelete'
  | 'exchangePreview';

type NewsItem = {
  id: string;
  title: string;
  description: string;
  mediaType: 'image' | 'video';
  imageUrl: string;
  videoUrl: string;
  thumbnailUrl: string;
  published: boolean;
  date: string;
  views: number;
  clicks: number;
  reach: number;
};

const normalizeNewsItem = (item: Record<string, unknown>): NewsItem => {
  const value = (...keys: string[]) => {
    const result = keys.map((key) => item[key]).find((entry) => typeof entry === 'string' && entry);
    return typeof result === 'string' ? result : '';
  };
  const videoUrl = value('videoUrl', 'video_url', 'video');
  const imageUrl = value('imageUrl', 'image_url', 'image');
  return {
    id: String(item.id ?? ''),
    title: value('title'),
    description: value('description'),
    mediaType: item.mediaType === 'video' || item.media_type === 'video' || videoUrl ? 'video' : 'image',
    imageUrl,
    videoUrl,
    thumbnailUrl: value('thumbnailUrl', 'thumbnail_url') || (videoUrl ? imageUrl : ''),
    published: item.published !== false,
    date: value('date'),
    views: Number(item.views || 0),
    clicks: Number(item.clicks || 0),
    reach: Number(item.reach || 0),
  };
};

type ServiceItem = {
  id: number;
  title: string;
  description: string;
  image: string;
  imageName: string;
  phone: string;
  website: string;
  location: string;
  published: boolean;
  views?: number;
  clicks?: number;
  reach?: number;
};

type ExchangeItem = {
  currency: 'MYR → MMK';
  rate: string;
  updatedAt?: string;
};

type ExchangeProviderItem = {
  id: string;
  name: string;
  rate: string;
  logoUrl: string;
  websiteUrl: string;
  published: boolean;
  displayOrder: number;
  updatedAt?: string;
};

const normalizeExchangeProvider = (item: Record<string, unknown>): ExchangeProviderItem => ({
  id: String(item.id ?? ''),
  name: typeof item.name === 'string' ? item.name : '',
  rate: formatRate(item.rate as string | number | null | undefined),
  logoUrl: typeof item.logoUrl === 'string'
    ? item.logoUrl
    : typeof item.logo_url === 'string'
      ? item.logo_url
      : '',
  websiteUrl: typeof item.websiteUrl === 'string'
    ? item.websiteUrl
    : typeof item.website_url === 'string'
      ? item.website_url
      : '',
  published: item.published !== false,
  displayOrder: Number(item.displayOrder ?? item.display_order ?? 0),
  updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
});

type AnalyticsItem = {
  contentType: 'news' | 'service';
  contentId: string;
  title: string;
  published: boolean;
  views: number;
  clicks: number;
  reach: number;
  updatedAt?: string;
};

type AnalyticsData = {
  summary: {
    views: number;
    clicks: number;
    reach: number;
  };
  items: AnalyticsItem[];
};

const emptyAnalytics: AnalyticsData = {
  summary: { views: 0, clicks: 0, reach: 0 },
  items: [],
};

type DiagnosticEntry = {
  id: string;
  level: 'error' | 'warning' | 'info';
  source: 'Frontend' | 'Admin API' | 'Authentication' | 'Backend';
  message: string;
  detail?: string;
  createdAt: string;
};

const formatRate = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(String(value).replace(/,/g, ''));
  return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value);
};

const initialNews: NewsItem[] = [];

const initialServices: ServiceItem[] = [];




const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Could not read the selected file.'));
      }
    };

    reader.onerror = () => {
      reject(reader.error || new Error('Could not read the selected file.'));
    };

    reader.readAsDataURL(file);
  });

const revokeObjectUrl = (value: string) => {
  if (value.startsWith('blob:')) URL.revokeObjectURL(value);
};

const initialExchange: ExchangeItem = {
  currency: 'MYR → MMK',
  rate: '',
};

type LoginScreenProps = {
  onAuthenticated: (user?: Partial<CurrentUser> | null) => void;
};

type CurrentUser = {
  name: string;
  email: string;
  avatarUrl: string;
};

type ApiResult<T> = {
  success: true;
  message?: string;
  data: T;
};

const ADMIN_SESSION_KEY = 'sagawa_admin_session_token';
const ADMIN_BROWSER_ID_KEY = 'sagawa_admin_browser_id';
const ADMIN_TRUSTED_BROWSER_KEY = 'sagawa_admin_trusted_browser';

const getAdminBrowserId = () => {
  if (typeof window === 'undefined') return '';
  let browserId = window.localStorage.getItem(ADMIN_BROWSER_ID_KEY) || '';
  if (!browserId) {
    const bytes = new Uint8Array(24);
    window.crypto.getRandomValues(bytes);
    browserId = Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
    window.localStorage.setItem(ADMIN_BROWSER_ID_KEY, browserId);
  }
  return browserId;
};

const getTrustedBrowserToken = () => {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(ADMIN_TRUSTED_BROWSER_KEY) || '';
};

const storeTrustedBrowserToken = (token?: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(ADMIN_TRUSTED_BROWSER_KEY, token);
  } else {
    window.localStorage.removeItem(ADMIN_TRUSTED_BROWSER_KEY);
  }
};

const adminBrowserHeaders = () => ({
  'X-Sagawa-Browser-Id': getAdminBrowserId(),
  ...(getTrustedBrowserToken()
    ? { 'X-Sagawa-Trusted-Browser': getTrustedBrowserToken() }
    : {}),
});

const getAdminSessionToken = () => {
  if (typeof window === 'undefined') return '';
  return window.sessionStorage.getItem(ADMIN_SESSION_KEY) || '';
};

const storeAdminSessionToken = (token?: string | null) => {
  if (typeof window === 'undefined') return;
  if (token) {
    window.sessionStorage.setItem(ADMIN_SESSION_KEY, token);
  } else {
    window.sessionStorage.removeItem(ADMIN_SESSION_KEY);
  }
};

async function readApiResponse<T>(response: Response): Promise<ApiResult<T>> {
  let result: Partial<ApiResult<T>> & { message?: string };

  try {
    result = await response.json();
  } catch {
    throw new Error('Request failed.');
  }

  if (!response.ok || result.success !== true) {
    throw new Error(result.message || 'The request failed.');
  }

  return result as ApiResult<T>;
}

type LoginStep = 'credentials' | 'emailVerification' | 'forgotPassword' | 'resetPassword';

function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyChecking, setPasskeyChecking] = useState(true);
  const [activeAuth, setActiveAuth] = useState<'password' | 'passkey' | 'email' | null>(null);
  const [loginVerificationId, setLoginVerificationId] = useState('');
  const [loginVerificationCode, setLoginVerificationCode] = useState('');
  const [loginEmailHint, setLoginEmailHint] = useState('');
  const [loginVerificationExpiresAt, setLoginVerificationExpiresAt] = useState('');
  const [resendBusy, setResendBusy] = useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'newpassword'>('request');

  useEffect(() => {
    setEmail('');
    setPassword('');

    let active = true;
    const detectPlatformPasskey = async () => {
      if (typeof window === 'undefined' || !('PublicKeyCredential' in window)) {
        if (active) {
          setPasskeyAvailable(false);
          setPasskeyChecking(false);
        }
        return;
      }

      try {
        const available =
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
            ? await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
            : true;

        if (active) setPasskeyAvailable(Boolean(available));
      } catch {
        if (active) setPasskeyAvailable(false);
      } finally {
        if (active) setPasskeyChecking(false);
      }
    };

    void detectPlatformPasskey();
    return () => {
      active = false;
    };
  }, []);

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordIsPresent = password.length > 0;
  const credentialsReady = emailIsValid && passwordIsPresent;
  const submitDisabled = loading || !credentialsReady;

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!emailIsValid || !passwordIsPresent) {
      setError('Enter your admin email and password.');
      return;
    }

    setLoading(true);
    setActiveAuth('password');
    setError('');

    try {
      const result = await readApiResponse<{
        authenticated?: boolean;
        sessionToken?: string;
        user?: Partial<CurrentUser> | null;
        verificationRequired?: boolean;
        verificationId?: string;
        verificationExpiresAt?: string;
        emailHint?: string;
      }>(await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...adminBrowserHeaders(),
        },
        body: JSON.stringify({ email: email.trim(), password }),
      }));

      if (result.data?.authenticated) {
        storeAdminSessionToken((result.data as { sessionToken?: string }).sessionToken);
        setError('');
        onAuthenticated((result.data as { user?: Partial<CurrentUser> | null }).user ?? null);
        return;
      }

      if (!result.data?.verificationRequired || !result.data?.verificationId) {
        throw new Error('Email verification was not started.');
      }

      storeAdminSessionToken(null);
      setLoginVerificationId(result.data.verificationId);
      setLoginVerificationCode('');
      setLoginEmailHint(result.data.emailHint || 'your admin email');
      setLoginVerificationExpiresAt(result.data.verificationExpiresAt || '');
      setPassword('');
      setError('');
      setStep('emailVerification');
    } catch (_err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
      setActiveAuth(null);
    }
  };

  const handlePasskeyLogin = async () => {
    if (loading || !passkeyAvailable) return;

    setLoading(true);
    setActiveAuth('passkey');
    setError('');

    try {
      const optionsResult = await readApiResponse<PublicKeyCredentialRequestOptionsJSON>(await fetch(
        apiUrl('/api/auth/passkey/authentication-options'),
        { method: 'POST', credentials: 'include' },
      ));

      if (!optionsResult.data || typeof optionsResult.data.challenge !== 'string') {
        throw new Error('Invalid passkey authentication options.');
      }

      const response = await startAuthentication({
        optionsJSON: optionsResult.data as any,
      });

      const result = await readApiResponse<{
        authenticated?: boolean;
        sessionToken?: string;
        user?: Partial<CurrentUser> | null;
      }>(await fetch(apiUrl('/api/auth/passkey/authentication'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }));

      storeAdminSessionToken(result.data?.sessionToken);
      setError('');
      onAuthenticated(result.data?.user ?? null);
    } catch (passkeyError) {
      console.error('[Admin Auth] Touch ID / passkey sign-in failed:', passkeyError);
      setError(
        'Touch ID / passkey sign-in was not completed. If this Mac is not registered yet, sign in with your password once and register Touch ID from the Admin panel.',
      );
    } finally {
      setLoading(false);
      setActiveAuth(null);
    }
  };

  const handleEmailVerification = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!loginVerificationId || !/^\d{6}$/.test(loginVerificationCode)) {
      setError('Enter the 6-digit code sent to your admin email.');
      return;
    }

    setLoading(true);
    setActiveAuth('email');
    setError('');

    try {
      const result = await readApiResponse<{
        authenticated?: boolean;
        sessionToken?: string;
        trustedBrowserToken?: string;
        user?: Partial<CurrentUser> | null;
      }>(await fetch(apiUrl('/api/auth/admin/verify-email'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Sagawa-Browser-Id': getAdminBrowserId(),
        },
        body: JSON.stringify({
          verificationId: loginVerificationId,
          code: loginVerificationCode,
        }),
      }));

      storeAdminSessionToken(result.data?.sessionToken);
      storeTrustedBrowserToken(result.data?.trustedBrowserToken);
      setLoginVerificationId('');
      setLoginVerificationCode('');
      setLoginVerificationExpiresAt('');
      setError('');
      onAuthenticated(result.data?.user ?? null);
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : 'Email verification failed. Please try again.',
      );
    } finally {
      setLoading(false);
      setActiveAuth(null);
    }
  };

  const handleResendLoginVerification = async () => {
    if (!loginVerificationId || resendBusy || loading) return;

    setResendBusy(true);
    setError('');

    try {
      const result = await readApiResponse<{
        verificationRequired?: boolean;
        verificationId?: string;
        verificationExpiresAt?: string;
        emailHint?: string;
      }>(await fetch(apiUrl('/api/auth/admin/resend-verification'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verificationId: loginVerificationId }),
      }));

      if (!result.data?.verificationId) {
        throw new Error('A new verification code could not be created.');
      }

      setLoginVerificationId(result.data.verificationId);
      setLoginVerificationCode('');
      setLoginEmailHint(result.data.emailHint || loginEmailHint);
      setLoginVerificationExpiresAt(result.data.verificationExpiresAt || '');
    } catch (resendError) {
      setError(
        resendError instanceof Error
          ? resendError.message
          : 'Could not resend the verification code.',
      );
    } finally {
      setResendBusy(false);
    }
  };

  const handleForgotPasswordRequest = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!forgotEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await readApiResponse<{ resetCodeSent?: boolean }>(await fetch(apiUrl('/api/auth/forgot-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim() }),
      }));
      setResetStep('verify');
      setError('');
    } catch (_err) {
      setError('Unable to send reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPasswordVerify = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!resetCode || resetCode.length !== 6 || !/^\d{6}$/.test(resetCode)) {
      setError('Please enter a valid 6-digit code.');
      return;
    }

    setError('');
    setResetStep('newpassword');
  };

  const handleResetPasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!newPassword || !confirmPassword) {
      setError('Please enter a new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }

    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setError('Password must include uppercase, lowercase, a number, and a special character.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await readApiResponse<{ passwordReset?: boolean }>(await fetch(apiUrl('/api/auth/reset-password'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: resetCode, newPassword, confirmPassword }),
      }));
      setStep('credentials');
      setEmail('');
      setPassword('');
      setForgotEmail('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setResetStep('request');
      setError('');
    } catch (_err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goBackToCredentials = () => {
    setStep('credentials');
    setLoginVerificationId('');
    setLoginVerificationCode('');
    setLoginEmailHint('');
    setLoginVerificationExpiresAt('');
    setForgotEmail('');
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setResetStep('request');
    setError('');
  };

  const renderLoginShell = (title: string, subtitle: string, children: React.ReactNode) => (
    <main className="login-shell simple-login-shell">
      <div className="login-live-orb orb-one" aria-hidden="true" />
      <div className="login-live-orb orb-two" aria-hidden="true" />
      <section className="simple-login-card">
        <div className="simple-logo-wrap">
          <span className="simple-logo-ring" aria-hidden="true" />
          <img src="/sagawa-flower-logo.svg" alt="Sagawa" className="simple-login-logo" />
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="simple-login-subtitle">{subtitle}</p>}
        {children}
      </section>
    </main>
  );

  if (step === 'credentials') {
    return renderLoginShell(
      'Welcome',
      '',
      (
        <>
          {passkeyAvailable && (
            <>
              <div className="passkey-primary-block">
                <button
                  className="passkey-primary-button"
                  type="button"
                  onClick={handlePasskeyLogin}
                  disabled={loading || passkeyChecking}
                >
                  <span className="passkey-fingerprint" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 11a2 2 0 0 0-2 2c0 3.6-1.2 5.8-2.5 7" />
                      <path d="M14.8 19.5c.8-1.7 1.2-3.9 1.2-6.5a4 4 0 0 0-8 0c0 1.7-.2 3-.7 4.3" />
                      <path d="M18.6 18.1c.3-1.5.4-3.2.4-5.1a7 7 0 0 0-14 0c0 .8 0 1.5-.1 2.2" />
                      <path d="M20.8 9.5A9.2 9.2 0 0 0 4 7.2" />
                      <path d="M12 3a9.5 9.5 0 0 1 9 6.5" />
                    </svg>
                  </span>
                  <span>
                    <strong>{activeAuth === 'passkey' ? 'Waiting for Touch ID…' : 'Use Touch ID / Passkey'}</strong>
                    <small>No email verification code required</small>
                  </span>
                  <span className="passkey-arrow" aria-hidden="true">→</span>
                </button>
              </div>

              <div className="login-divider"><span>or use email and password</span></div>
            </>
          )}

          <form className="login-form-v3" onSubmit={handlePasswordLogin} noValidate autoComplete="off">
            <div className="login-field">
              <label htmlFor="admin-email">Email</label>
              <input
                id="admin-email"
                name="sagawa-admin-email-entry"
                type="email"
                autoComplete="off"
                inputMode="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                aria-invalid={email.length > 0 && !emailIsValid}
                disabled={loading}
                placeholder=""
                spellCheck={false}
              />
            </div>

            <div className="login-field">
              <div className="login-field-heading">
                <label htmlFor="admin-password">Password</label>
                <button
                  type="button"
                  className="login-inline-link"
                  onClick={() => {
                    setStep('forgotPassword');
                    setForgotEmail('');
                    setResetCode('');
                    setNewPassword('');
                    setConfirmPassword('');
                    setResetStep('request');
                    setError('');
                  }}
                  disabled={loading}
                >
                  Forgot password?
                </button>
              </div>

              <div className="password-input-container">
                <input
                  id="admin-password"
                  name="sagawa-admin-password-entry"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                  placeholder=""
                  spellCheck="false"
                  className="password-input-field"
                />
                <button
                  className="password-input-button"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  disabled={loading}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="login-error login-error-v3" role="alert">{error}</div>}

            <button className="primary-button login-button login-submit-v3" type="submit" disabled={submitDisabled}>
              {activeAuth === 'password' ? 'Signing in…' : 'Login with email and password'}
              <span aria-hidden="true">→</span>
            </button>
          </form>
        </>
      ),
    );
  }

  if (step === 'emailVerification') {
    const expiryLabel = loginVerificationExpiresAt
      ? new Date(loginVerificationExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return renderLoginShell(
      'Verify this sign-in',
      `We sent a one-time code to ${loginEmailHint || 'your admin email'}. This browser is new, so password sign-in needs one email verification. Future password sign-ins on this browser can skip this step.`,
      (
        <>
          <div className="two-step-security-card">
            <div className="two-step-security-icon" aria-hidden="true">2</div>
            <div>
              <strong>Two-step verification</strong>
              <span>Email confirmation is required only for a new browser or device when signing in with email and password.</span>
            </div>
          </div>

          <form className="login-form-v3" onSubmit={handleEmailVerification} noValidate>
            <div className="login-field">
              <label htmlFor="admin-login-code">6-digit verification code</label>
              <input
                id="admin-login-code"
                className="verification-code-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                value={loginVerificationCode}
                onChange={(event) => setLoginVerificationCode(event.target.value.replace(/\D/g, ''))}
                autoFocus
                required
                disabled={loading}
                placeholder=""
              />
              <small className="login-field-note">
                {expiryLabel ? `Code expires around ${expiryLabel}.` : 'The code expires after a few minutes.'}
              </small>
            </div>

            {error && <div className="login-error login-error-v3" role="alert">{error}</div>}

            <button
              className="primary-button login-button login-submit-v3"
              type="submit"
              disabled={loading || loginVerificationCode.length !== 6}
            >
              {activeAuth === 'email' ? 'Verifying…' : 'Verify and open Admin'}
              <span aria-hidden="true">→</span>
            </button>
          </form>

          <div className="two-step-actions">
            <button
              className="login-back-button"
              type="button"
              onClick={handleResendLoginVerification}
              disabled={loading || resendBusy}
            >
              {resendBusy ? 'Sending new code…' : 'Resend code'}
            </button>
            <button className="login-back-button" type="button" onClick={goBackToCredentials} disabled={loading}>
              ← Use another sign-in method
            </button>
          </div>
        </>
      ),
    );
  }

  if (step === 'forgotPassword') {
    if (resetStep === 'request') {
      return renderLoginShell(
        'Reset password',
        'Enter the admin email address. We will send a one-time verification code.',
        (
          <>
            <form className="login-form-v3" onSubmit={handleForgotPasswordRequest} noValidate autoComplete="off">
              <div className="login-field">
                <label htmlFor="forgot-email">Email</label>
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="off"
                  inputMode="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  required
                  disabled={loading}
                  placeholder=""
                  spellCheck={false}
                />
              </div>

              {error && <div className="login-error login-error-v3" role="alert">{error}</div>}

              <button className="primary-button login-button login-submit-v3" type="submit" disabled={loading || !forgotEmail}>
                {loading ? 'Sending code…' : 'Send reset code'}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <button className="login-back-button" type="button" onClick={goBackToCredentials} disabled={loading}>
              ← Back to sign in
            </button>
          </>
        ),
      );
    }

    if (resetStep === 'verify') {
      return renderLoginShell(
        'Verify reset code',
        'Enter the six-digit code sent to your admin email.',
        (
          <>
            <form className="login-form-v3" onSubmit={handleResetPasswordVerify} noValidate>
              <div className="login-field">
                <label htmlFor="reset-code">6-digit code</label>
                <input
                  id="reset-code"
                  className="verification-code-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(event) => setResetCode(event.target.value.replace(/\D/g, ''))}
                  required
                  disabled={loading}
                  placeholder=""
                  autoComplete="one-time-code"
                />
              </div>

              {error && <div className="login-error login-error-v3" role="alert">{error}</div>}

              <button className="primary-button login-button login-submit-v3" type="submit" disabled={loading || resetCode.length !== 6}>
                Continue
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <button
              className="login-back-button"
              type="button"
              onClick={() => {
                setResetStep('request');
                setResetCode('');
                setError('');
              }}
              disabled={loading}
            >
              ← Request a new code
            </button>
          </>
        ),
      );
    }

    if (resetStep === 'newpassword') {
      return renderLoginShell(
        'Create new password',
        'Choose a strong password for the Sagawa administrator account.',
        (
          <>
            <form className="login-form-v3" onSubmit={handleResetPasswordSubmit} noValidate autoComplete="off">
              <div className="login-field">
                <label htmlFor="new-password">New password</label>
                <div className="password-input-container">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    required
                    disabled={loading}
                    placeholder=""
                    spellCheck="false"
                    className="password-input-field"
                  />
                  <button
                    className="password-input-button"
                    type="button"
                    onClick={() => setShowNewPassword((current) => !current)}
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                    tabIndex={-1}
                  >
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="login-field">
                <label htmlFor="confirm-password">Confirm password</label>
                <div className="password-input-container">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    disabled={loading}
                    placeholder=""
                    spellCheck="false"
                    className="password-input-field"
                  />
                  <button
                    className="password-input-button"
                    type="button"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    disabled={loading}
                    tabIndex={-1}
                  >
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <ul className="password-policy-list password-policy-v3">
                <li className={newPassword.length >= 12 ? 'met' : ''}>12+ characters</li>
                <li className={/[a-z]/.test(newPassword) ? 'met' : ''}>Lowercase</li>
                <li className={/[A-Z]/.test(newPassword) ? 'met' : ''}>Uppercase</li>
                <li className={/\d/.test(newPassword) ? 'met' : ''}>Number</li>
                <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'met' : ''}>Special character</li>
              </ul>

              {error && <div className="login-error login-error-v3" role="alert">{error}</div>}

              <button
                className="primary-button login-button login-submit-v3"
                type="submit"
                disabled={loading || newPassword !== confirmPassword || newPassword.length < 12}
              >
                {loading ? 'Updating password…' : 'Update password'}
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <button className="login-back-button" type="button" onClick={goBackToCredentials} disabled={loading}>
              ← Back to sign in
            </button>
          </>
        ),
      );
    }
  }

  return null;
}

const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const token = getAdminSessionToken();
  const headers = new Headers(init.headers || undefined);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    credentials: 'include',
  });
};

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    name: 'Admin',
    email: '',
    avatarUrl: '',
  });
  const normalizeCurrentUser = (user?: Partial<CurrentUser> | null): CurrentUser => ({
    name: typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Admin',
    email: typeof user?.email === 'string' ? user.email : '',
    avatarUrl: typeof user?.avatarUrl === 'string' ? user.avatarUrl : '',
  });
  const [activePage, setActivePage] =
    useState<Page>('dashboard');

  const [modal, setModal] =
    useState<ModalMode>('none');

  const [news, setNews] =
    useState<NewsItem[]>(initialNews);

  const [services, setServices] =
    useState<ServiceItem[]>(initialServices);

  const [exchangeRate, setExchangeRate] =
    useState<ExchangeItem>(initialExchange);

  const [exchangeProviders, setExchangeProviders] =
    useState<ExchangeProviderItem[]>([]);

  const [analytics, setAnalytics] =
    useState<AnalyticsData>(emptyAnalytics);

  const [searchNews, setSearchNews] =
    useState('');

  const [searchServices, setSearchServices] =
    useState('');

  const [editingNewsId, setEditingNewsId] =
    useState<string | null>(null);

  const [editingServiceId, setEditingServiceId] =
    useState<number | null>(null);

  const [deleteNewsId, setDeleteNewsId] =
    useState<string | null>(null);

  const [deleteServiceId, setDeleteServiceId] =
    useState<number | null>(null);

  const [previewNews, setPreviewNews] =
    useState<NewsItem | null>(null);

  const [previewService, setPreviewService] =
    useState<ServiceItem | null>(null);

  /* =========================================================
     NEWS DRAFT
  ========================================================= */

  const [newsTitle, setNewsTitle] =
    useState('');

  const [newsDescription, setNewsDescription] =
    useState('');

  const [newsPublished, setNewsPublished] =
    useState(true);

  const [newsMediaType, setNewsMediaType] =
    useState<'image' | 'video'>('image');

  const [newsImageFile, setNewsImageFile] =
    useState<File | null>(null);

  const [newsImagePreview, setNewsImagePreview] =
    useState('');

  const [newsVideoFile, setNewsVideoFile] =
    useState<File | null>(null);

  const [newsVideoPreview, setNewsVideoPreview] =
    useState('');

  const [newsThumbnailFile, setNewsThumbnailFile] =
    useState<File | null>(null);

  const [newsThumbnailPreview, setNewsThumbnailPreview] =
    useState('');

  /* =========================================================
     SERVICE DRAFT
  ========================================================= */

  const [serviceTitle, setServiceTitle] =
    useState('');

  const [serviceDescription, setServiceDescription] =
    useState('');

  const [servicePhone, setServicePhone] =
    useState('');

  const [serviceWebsite, setServiceWebsite] =
    useState('');

  const [serviceLocation, setServiceLocation] =
    useState('');

  const [servicePublished, setServicePublished] =
    useState(true);

  const [serviceImagePreview, setServiceImagePreview] =
    useState('');

  const [serviceImageName, setServiceImageName] =
    useState('');

  /* =========================================================
     EXCHANGE DRAFT
  ========================================================= */

  const [exchangeDraft, setExchangeDraft] =
    useState<ExchangeItem>(initialExchange);

  const [exchangeProviderDrafts, setExchangeProviderDrafts] =
    useState<ExchangeProviderItem[]>([]);

  const [exchangeProviderLogoFiles, setExchangeProviderLogoFiles] =
    useState<Record<string, File>>({});

  const [exchangeProviderLogoPreviews, setExchangeProviderLogoPreviews] =
    useState<Record<string, string>>({});

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [backendHealth, setBackendHealth] = useState<'checking' | 'healthy' | 'error'>('checking');
  const [diagnostics, setDiagnostics] = useState<DiagnosticEntry[]>([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showAdminProfile, setShowAdminProfile] = useState(false);
  const [adminProfileName, setAdminProfileName] = useState('Admin');
  const [adminProfileAvatarFile, setAdminProfileAvatarFile] = useState<File | null>(null);
  const [adminProfileAvatarPreview, setAdminProfileAvatarPreview] = useState('');
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [adminProfileError, setAdminProfileError] = useState('');

  const recordDiagnostic = useCallback((
    entry: Omit<DiagnosticEntry, 'id' | 'createdAt'>,
  ) => {
    setDiagnostics((current) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toLocaleTimeString(),
      },
      ...current,
    ].slice(0, 12));
  }, []);

  const runHealthCheck = useCallback(async () => {
    setBackendHealth('checking');
    try {
      const response = await adminFetch(apiUrl('/health'));
      if (!response.ok) {
        throw new Error(`Health endpoint returned HTTP ${response.status}`);
      }

      const payload = await response.json();
      if (payload?.status !== 'ok') {
        throw new Error(`Unexpected health response: ${JSON.stringify(payload)}`);
      }

      setBackendHealth('healthy');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setBackendHealth('error');
      recordDiagnostic({
        level: 'error',
        source: 'Backend',
        message,
        detail: `GET ${apiUrl('/health')}`,
      });
    }
  }, [recordDiagnostic]);

  useEffect(() => {
    if (authenticated === true) {
      void runHealthCheck();
    }
  }, [authenticated, runHealthCheck]);

  useEffect(() => {
    const handleWindowError = (event: ErrorEvent) => {
      recordDiagnostic({
        level: 'error',
        source: 'Frontend',
        message: event.error instanceof Error ? event.error.message : event.message || 'Unknown browser error',
        detail: [event.filename, event.lineno ? `line ${event.lineno}` : ''].filter(Boolean).join(' • '),
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      recordDiagnostic({
        level: 'error',
        source: 'Frontend',
        message: reason instanceof Error ? reason.message : String(reason ?? 'Unhandled promise rejection'),
        detail: reason instanceof Error && reason.stack ? reason.stack.split('\n').slice(0, 3).join(' | ') : undefined,
      });
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [recordDiagnostic]);

  useEffect(() => {
    void adminFetch(apiUrl('/api/auth/me'))
      .then((response) => readApiResponse<{ authenticated?: boolean; user?: Partial<CurrentUser> | null }>(response))
      .then((result) => {
        const nextAuthenticated = Boolean(result.data?.authenticated);
        if (!nextAuthenticated) storeAdminSessionToken(null);
        const nextUser = normalizeCurrentUser(result.data?.user ?? null);
        setCurrentUser(nextUser);
        setAuthenticated(nextAuthenticated);
      })
      .catch((error) => {
        console.error('[Admin Auth] Session check failed:', error);
        recordDiagnostic({
          level: 'error',
          source: 'Authentication',
          message: error instanceof Error ? error.message : String(error),
          detail: 'GET /api/auth/me',
        });
        setCurrentUser({ name: 'Admin', email: '', avatarUrl: '' });
        setAuthenticated(false);
      });
  }, [recordDiagnostic]);

  const loadAdminProfile = useCallback(async () => {
    try {
      const result = await readApiResponse<CurrentUser>(
        await adminFetch(apiUrl('/api/admin/profile')),
      );
      const profile = normalizeCurrentUser(result.data);
      setCurrentUser(profile);
      setAdminProfileName(profile.name);
      setAdminProfileAvatarPreview(profile.avatarUrl);
    } catch (error) {
      console.error('[AdminProfile] Load failed:', error);
    }
  }, []);

  useEffect(() => {
    if (authenticated === true) {
      void loadAdminProfile();
    }
  }, [authenticated, loadAdminProfile]);

  const openAdminProfile = () => {
    setAdminProfileName(currentUser.name || 'Admin');
    setAdminProfileAvatarPreview(currentUser.avatarUrl || '');
    setAdminProfileAvatarFile(null);
    setAdminProfileError('');
    setShowAdminProfile(true);
  };

  const handleAdminProfilePhoto = (file?: File | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setAdminProfileError('Use a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAdminProfileError('Photo must be 2 MB or smaller.');
      return;
    }
    setAdminProfileError('');
    setAdminProfileAvatarFile(file);
    setAdminProfileAvatarPreview(URL.createObjectURL(file));
  };

  const saveAdminProfile = async () => {
    const name = adminProfileName.trim();
    if (!name) {
      setAdminProfileError('Admin name is required.');
      return;
    }

    setAdminProfileSaving(true);
    setAdminProfileError('');
    try {
      const body = new FormData();
      body.append('name', name);
      if (adminProfileAvatarFile) body.append('avatar', adminProfileAvatarFile);

      const result = await readApiResponse<CurrentUser>(
        await adminFetch(apiUrl('/api/admin/profile'), {
          method: 'PUT',
          body,
        }),
      );

      const profile = normalizeCurrentUser(result.data);
      setCurrentUser(profile);
      setAdminProfileName(profile.name);
      setAdminProfileAvatarPreview(profile.avatarUrl);
      setAdminProfileAvatarFile(null);
      setShowAdminProfile(false);
    } catch (error) {
      setAdminProfileError(error instanceof Error ? error.message : 'Could not save admin profile.');
    } finally {
      setAdminProfileSaving(false);
    }
  };

  const logout = async () => {
    try {
      await adminFetch(apiUrl('/api/auth/logout'), { method: 'POST' });
    } finally {
      storeAdminSessionToken(null);
      setCurrentUser({ name: 'Admin', email: '', avatarUrl: '' });
      setAuthenticated(false);
      setShowPasswordChange(false);
    }
  };

  const submitPasswordChange = async () => {
    const currentPassword = passwordChangeForm.currentPassword.trim();
    const newPassword = passwordChangeForm.newPassword;
    const confirmPassword = passwordChangeForm.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordChangeError('Please complete all password fields.');
      return;
    }

    if (newPassword.length < 12) {
      setPasswordChangeError('New password must be at least 12 characters long.');
      return;
    }

    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      setPasswordChangeError('New password must include uppercase, lowercase, a number, and a special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    setPasswordChangeLoading(true);
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    try {
      const response = await adminFetch(apiUrl('/api/auth/change-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const result = await readApiResponse(response);
      setPasswordChangeSuccess(result.message || 'Password updated successfully.');
      setPasswordChangeForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setCurrentUser({ name: 'Admin', email: '', avatarUrl: '' });
      setAuthenticated(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed.';
      setPasswordChangeError(message);
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const registerPasskey = async () => {
    if (passkeyBusy) return;

    setPasskeyBusy(true);
    setPasskeyMessage('');
    try {
      const optionsResult = await readApiResponse<PublicKeyCredentialCreationOptionsJSON>(await adminFetch(
        apiUrl('/api/auth/passkey/registration-options'),
        { method: 'POST' },
      ));

      if (!optionsResult.data || typeof optionsResult.data.challenge !== 'string') {
        throw new Error('Passkey registration options are invalid or incomplete.');
      }

      const response = await startRegistration({
        optionsJSON: optionsResult.data as any,
      });

      await readApiResponse(await adminFetch(apiUrl('/api/auth/passkey/registration'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }));

      setPasskeyMessage('Passkey registered. You can use Touch ID or your device passkey next time.');
      recordDiagnostic({
        level: 'info',
        source: 'Authentication',
        message: 'Passkey registration completed successfully.',
        detail: window.location.hostname,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not register passkey.';
      console.error('[Admin Auth] Passkey registration failed:', error);
      setPasskeyMessage(message);
      recordDiagnostic({
        level: 'error',
        source: 'Authentication',
        message,
        detail: 'POST /api/auth/passkey/registration-options → WebAuthn → /api/auth/passkey/registration',
      });
    } finally {
      setPasskeyBusy(false);
    }
  };

  /* =========================================================
     API
  ========================================================= */

  useEffect(() => {
  if (authenticated !== true) return undefined;
  let cancelled = false;

  const loadContent = async () => {
    try {
      setApiLoading(true);
      setApiError('');

      const [newsResponse, servicesResponse, exchangeResponse, analyticsResponse] =
        await Promise.all([
          adminFetch(apiUrl('/api/news')),
          adminFetch(apiUrl('/api/services')),
          adminFetch(apiUrl('/api/exchange-rate')),
          adminFetch(apiUrl('/api/admin/analytics')),
        ]);

      if (!newsResponse.ok) {
        throw new Error(`News API returned ${newsResponse.status}`);
      }

      if (!servicesResponse.ok) {
        throw new Error(
          `Services API returned ${servicesResponse.status}`,
        );
      }

      if (!exchangeResponse.ok) {
        throw new Error(
          `Exchange API returned ${exchangeResponse.status}`,
        );
      }

      if (!analyticsResponse.ok) {
        throw new Error(
          `Analytics API returned ${analyticsResponse.status}`,
        );
      }

      const newsResult = await newsResponse.json();
      const servicesResult = await servicesResponse.json();
      const exchangeResult = await exchangeResponse.json();
      const analyticsResult = await analyticsResponse.json();

      if (
        !newsResult.success ||
        !Array.isArray(newsResult.data)
      ) {
        throw new Error('Invalid news API response.');
      }

      if (
        !servicesResult.success ||
        !Array.isArray(servicesResult.data)
      ) {
        throw new Error('Invalid services API response.');
      }

      const rawExchange =
        exchangeResult?.data ?? exchangeResult;

      const loadedProviders = Array.isArray(rawExchange?.providers)
        ? rawExchange.providers
            .map((item: Record<string, unknown>) => normalizeExchangeProvider(item))
            .sort((left: ExchangeProviderItem, right: ExchangeProviderItem) =>
              left.displayOrder - right.displayOrder)
        : [];

      let loadedRate = '';

      if (
        typeof rawExchange?.rate === 'string' ||
        typeof rawExchange?.rate === 'number'
      ) {
        loadedRate = formatRate(rawExchange.rate);
      } else if (Array.isArray(rawExchange?.rates)) {
        const myrRate = rawExchange.rates.find(
          (item: Partial<ExchangeItem> & {
            buy?: string | number;
            sell?: string | number;
          }) => item.currency === 'MYR → MMK',
        );

        loadedRate = formatRate(
          myrRate?.rate ??
            myrRate?.buy ??
            myrRate?.sell ??
            '',
        );
      } else if (Array.isArray(rawExchange)) {
        const myrRate = rawExchange.find(
          (item: Partial<ExchangeItem> & {
            buy?: string | number;
            sell?: string | number;
          }) => item.currency === 'MYR → MMK',
        );

        loadedRate = formatRate(
          myrRate?.rate ??
            myrRate?.buy ??
            myrRate?.sell ??
            '',
        );
      }

      if (!cancelled) {
        setNews(newsResult.data.map((item: Record<string, unknown>) => normalizeNewsItem(item)));
        setServices(servicesResult.data.slice(0, 25).map((item: ServiceItem) => ({
          ...item,
          views: Number(item.views || 0),
          clicks: Number(item.clicks || 0),
          reach: Number(item.reach || 0),
        })));

        if (analyticsResult?.success && analyticsResult?.data) {
          setAnalytics({
            summary: {
              views: Number(analyticsResult.data.summary?.views || 0),
              clicks: Number(analyticsResult.data.summary?.clicks || 0),
              reach: Number(analyticsResult.data.summary?.reach || 0),
            },
            items: Array.isArray(analyticsResult.data.items)
              ? analyticsResult.data.items.map((item: AnalyticsItem) => ({
                  ...item,
                  views: Number(item.views || 0),
                  clicks: Number(item.clicks || 0),
                  reach: Number(item.reach || 0),
                }))
              : [],
          });
        }

        setExchangeProviders(loadedProviders);
        setExchangeProviderDrafts(loadedProviders);

        if (
          loadedRate &&
          loadedRate !== 'undefined'
        ) {
          const loadedExchange: ExchangeItem = {
            currency: 'MYR → MMK',
            rate: loadedRate,
            updatedAt: typeof rawExchange?.updatedAt === 'string' ? rawExchange.updatedAt : undefined,
          };

          setExchangeRate(loadedExchange);
          setExchangeDraft(loadedExchange);
        }
      }
    } catch (error) {
      console.error('Failed to load admin content:', error);

      if (!cancelled) {
        const message =
          error instanceof Error ? error.message : String(error);
        console.error('[Admin API] Load failed:', {
          baseUrl: API_BASE || '(missing)',
          message,
        });
        setApiError(
          API_BASE
            ? 'Could not connect to the API. Check the backend URL and server logs.'
            : 'Admin API URL is not configured. Set VITE_API_URL and restart the admin panel.',
        );
        recordDiagnostic({
          level: 'error',
          source: 'Admin API',
          message,
          detail: API_BASE
            ? `GET news/services/exchange • ${API_BASE}`
            : 'VITE_API_URL is missing',
        });
      }
    } finally {
      if (!cancelled) {
        setApiLoading(false);
      }
    }
  };

  void loadContent();

  return () => {
    cancelled = true;
  };
}, [authenticated, recordDiagnostic]);

  /* =========================================================
     MENU
  ========================================================= */

  const menuItems: Array<{
    id: Page;
    label: string;
    icon: string;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '⌂',
    },
    {
      id: 'news',
      label: 'News',
      icon: '▤',
    },
    {
      id: 'services',
      label: 'Services',
      icon: '▦',
    },
    {
      id: 'exchange',
      label: 'Exchange Rate',
      icon: '$',
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: '↗',
    },
  ];

  /* =========================================================
     SEARCH
  ========================================================= */

  const filteredNews = useMemo(() => {
    const value = searchNews.trim().toLowerCase();

    if (!value) {
      return news;
    }

    return news.filter((item) =>
      `${item.title} ${item.description}`
        .toLowerCase()
        .includes(value)
    );
  }, [news, searchNews]);

  const filteredServices = useMemo(() => {
    const value =
      searchServices.trim().toLowerCase();

    if (!value) {
      return services;
    }

    return services.filter((item) =>
      `${item.title} ${item.description} ${item.location}`
        .toLowerCase()
        .includes(value)
    );
  }, [services, searchServices]);

  /* =========================================================
     MODAL
  ========================================================= */

  const closeModal = () => {
    setModal('none');
  };

  /* =========================================================
     NEWS
  ========================================================= */

  const openAddNews = () => {
    revokeObjectUrl(newsImagePreview);
    revokeObjectUrl(newsVideoPreview);
    revokeObjectUrl(newsThumbnailPreview);
    setEditingNewsId(null);

    setNewsTitle('');
    setNewsDescription('');
    setNewsPublished(true);
    setNewsMediaType('image');

    setNewsImageFile(null);
    setNewsImagePreview('');

    setNewsVideoFile(null);
    setNewsVideoPreview('');
    setNewsThumbnailFile(null);
    setNewsThumbnailPreview('');

    setModal('newsForm');
  };

  const openEditNews = (item: NewsItem) => {
    revokeObjectUrl(newsImagePreview);
    revokeObjectUrl(newsVideoPreview);
    revokeObjectUrl(newsThumbnailPreview);
    setEditingNewsId(item.id);

    setNewsTitle(item.title);
    setNewsDescription(item.description);
    setNewsPublished(item.published);
    setNewsMediaType(item.mediaType);

    setNewsImageFile(null);
    setNewsImagePreview(mediaUrl(item.imageUrl));

    setNewsVideoFile(null);
    setNewsVideoPreview(mediaUrl(item.videoUrl));
    setNewsThumbnailFile(null);
    setNewsThumbnailPreview(mediaUrl(item.thumbnailUrl));

    setModal('newsForm');
  };

  const handleNewsImage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Image must be a JPEG, PNG, or WebP file.');
      event.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }

    setNewsImageFile(file);
    setNewsImagePreview((current) => {
      revokeObjectUrl(current);
      return URL.createObjectURL(file);
    });
  };

  const handleNewsVideo = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
      alert('Video must be an MP4, MOV, or WebM file.');
      event.target.value = '';
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert('Video must be 100 MB or smaller.');
      event.target.value = '';
      return;
    }

    setNewsVideoFile(file);
    setNewsVideoPreview((current) => {
      revokeObjectUrl(current);
      return URL.createObjectURL(file);
    });
  };

  const handleNewsThumbnail = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Thumbnail must be a JPEG, PNG, or WebP image.');
      event.target.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('Thumbnail must be 10 MB or smaller.');
      event.target.value = '';
      return;
    }
    setNewsThumbnailFile(file);
    setNewsThumbnailPreview((current) => {
      revokeObjectUrl(current);
      return URL.createObjectURL(file);
    });
  };

  const previewNewsDraft = () => {
    const title = newsTitle.trim();
    const description =
      newsDescription.trim();

    if (!title) {
      alert('Please enter a news title.');
      return;
    }

    if (!description) {
      alert(
        'Please enter a news description.'
      );
      return;
    }

    if (newsMediaType === 'image' && !newsImagePreview) {
      alert('Please choose a news image.');
      return;
    }

    if (newsMediaType === 'video' && (!newsVideoPreview || !newsThumbnailPreview)) {
      alert('Please choose both a video and a thumbnail image.');
      return;
    }

    const existingNews = editingNewsId
      ? news.find(
          (item) => item.id === editingNewsId
        )
      : undefined;

    const draft: NewsItem = {
      id: editingNewsId ?? String(Date.now()),

      title,

      description,

      mediaType: newsMediaType,

      imageUrl: newsMediaType === 'image' ? newsImagePreview : '',

      videoUrl: newsMediaType === 'video' ? newsVideoPreview : '',

      thumbnailUrl: newsMediaType === 'video' ? newsThumbnailPreview : '',

      published: newsPublished,

      date:
        existingNews?.date ||
        new Date().toLocaleDateString(
          'en-GB',
          {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }
        ),

      views: existingNews?.views ?? 0,
      clicks: existingNews?.clicks ?? 0,
      reach: existingNews?.reach ?? 0,
    };

    setPreviewNews(draft);

    setModal('newsPreview');
  };

  const confirmNews = async () => {
    if (!previewNews) {
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const isEditing = editingNewsId !== null;
      const url = isEditing
        ? apiUrl(`/api/news/${editingNewsId}`)
        : apiUrl('/api/news');

      const formData = new FormData();
      formData.append('title', previewNews.title);
      formData.append('description', previewNews.description);
      formData.append('mediaType', previewNews.mediaType);
      formData.append('published', String(previewNews.published));
      if (newsMediaType === 'image' && newsImageFile) formData.append('image', newsImageFile);
      if (newsMediaType === 'video' && newsVideoFile) formData.append('video', newsVideoFile);
      if (newsMediaType === 'video' && newsThumbnailFile) {
        formData.append('thumbnail', newsThumbnailFile);
      }

      const response = await adminFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not save news.'
        );
      }

      const savedItem = normalizeNewsItem(result.data as Record<string, unknown>);

      if (isEditing) {
        setNews((current) =>
          current.map((item) =>
            item.id === savedItem.id
              ? savedItem
              : item
          )
        );
      } else {
        setNews((current) => [
          savedItem,
          ...current,
        ]);
      }

      setPreviewNews(null);
      setModal('none');
    } catch (error) {
      console.error('Save news error:', error);

      const message = error instanceof Error ? error.message : 'Could not save news.';
      setApiError(message);
      alert(message);
    } finally {
      setApiLoading(false);
    }
  };

  const askDeleteNews = (id: string) => {
    setDeleteNewsId(id);
    setModal('newsDelete');
  };

  const confirmDeleteNews = async () => {
    if (deleteNewsId === null) {
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const response = await adminFetch(
        apiUrl(`/api/news/${deleteNewsId}`),
        {
          method: 'DELETE',
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not delete news.'
        );
      }

      setNews((current) =>
        current.filter(
          (item) => item.id !== deleteNewsId
        )
      );
      setAnalytics((current) => {
        const removed = current.items.find(
          (item) => item.contentType === 'news' && item.contentId === String(deleteNewsId),
        );
        return {
          summary: {
            views: Math.max(0, current.summary.views - Number(removed?.views || 0)),
            clicks: Math.max(0, current.summary.clicks - Number(removed?.clicks || 0)),
            reach: Math.max(0, current.summary.reach - Number(removed?.reach || 0)),
          },
          items: current.items.filter(
            (item) => !(item.contentType === 'news' && item.contentId === String(deleteNewsId)),
          ),
        };
      });

      setDeleteNewsId(null);
      setModal('none');
    } catch (error) {
      console.error('Delete news error:', error);

      setApiError(
        'Could not delete news. Make sure the Local API is running.'
      );
      alert(
        'Could not delete news. Please check that the Local API is running.'
      );
    } finally {
      setApiLoading(false);
    }
  };

  const toggleNewsPublished = async (id: string) => {
    const item = news.find((newsItem) => newsItem.id === id);

    if (!item) {
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const response = await adminFetch(
        apiUrl(`/api/news/${id}`),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            published: !item.published,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not update publish status.'
        );
      }

      setNews((current) =>
        current.map((currentItem) =>
          currentItem.id === id
            ? normalizeNewsItem(result.data as Record<string, unknown>)
            : currentItem
        )
      );
    } catch (error) {
      console.error('Publish status error:', error);

      setApiError(
        'Could not update publish status. Make sure the Local API is running.'
      );
      alert(
        'Could not update publish status. Please check that the Local API is running.'
      );
    } finally {
      setApiLoading(false);
    }
  };

  /* =========================================================
     SERVICES
  ========================================================= */

  const openAddService = () => {
    if (services.length >= 25) {
      alert('You can have a maximum of 25 services.');
      return;
    }

    setEditingServiceId(null);
    setServiceTitle('');
    setServiceDescription('');
    setServicePhone('');
    setServiceWebsite('');
    setServiceLocation('');
    setServicePublished(true);
    setServiceImagePreview('');
    setServiceImageName('');
    setModal('serviceForm');
  };

  const openEditService = (item: ServiceItem) => {
    setEditingServiceId(item.id);
    setServiceTitle(item.title);
    setServiceDescription(item.description);
    setServicePhone(item.phone);
    setServiceWebsite(item.website);
    setServiceLocation(item.location);
    setServicePublished(item.published);
    setServiceImagePreview(item.image);
    setServiceImageName(item.imageName);
    setModal('serviceForm');
  };

  const handleServiceImage = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);
      setServiceImagePreview(dataUrl);
      setServiceImageName(file.name);
    } catch (error) {
      console.error('Service image read error:', error);
      alert('Could not read the selected image.');
    }
  };

  const previewServiceDraft = () => {
    const title = serviceTitle.trim();
    const description = serviceDescription.trim();

    if (!title) {
      alert('Please enter a service title.');
      return;
    }

    if (!description) {
      alert('Please enter a service description.');
      return;
    }

    const draft: ServiceItem = {
      id: editingServiceId ?? Date.now(),
      title,
      description,
      image: serviceImagePreview,
      imageName: serviceImageName,
      phone: servicePhone.trim(),
      website: serviceWebsite.trim(),
      location: serviceLocation.trim(),
      published: servicePublished,
    };

    setPreviewService(draft);
    setModal('servicePreview');
  };

  const confirmService = async () => {
    if (!previewService) return;

    if (
      editingServiceId === null &&
      services.length >= 25
    ) {
      alert('You can have a maximum of 25 services.');
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const isEditing = editingServiceId !== null;
      const url = isEditing
        ? apiUrl(`/api/services/${editingServiceId}`)
        : apiUrl('/api/services');

      const response = await adminFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(previewService),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not save service.',
        );
      }

      const savedService =
        (result.data as ServiceItem | undefined) ||
        previewService;

      if (isEditing) {
        setServices((current) =>
          current.map((item) =>
            item.id === savedService.id
              ? savedService
              : item,
          ),
        );
      } else {
        setServices((current) => [
          savedService,
          ...current,
        ]);
      }

      setPreviewService(null);
      setModal('none');
    } catch (error) {
      console.error('Save service error:', error);
      setApiError(
        'Could not save service. Make sure the Local API is running.',
      );
      alert(
        'Could not save service. Please check the Local API.',
      );
    } finally {
      setApiLoading(false);
    }
  };

  const askDeleteService = (id: number) => {
    setDeleteServiceId(id);
    setModal('serviceDelete');
  };

  const confirmDeleteService = async () => {
    if (deleteServiceId === null) return;

    try {
      setApiError('');
      setApiLoading(true);

      const response = await adminFetch(
        apiUrl(`/api/services/${deleteServiceId}`),
        {
          method: 'DELETE',
          headers: {
            Accept: 'application/json',
          },
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not delete service.',
        );
      }

      setServices((current) =>
        current.filter(
          (item) => item.id !== deleteServiceId,
        ),
      );
      setAnalytics((current) => {
        const removed = current.items.find(
          (item) => item.contentType === 'service' && item.contentId === String(deleteServiceId),
        );
        return {
          summary: {
            views: Math.max(0, current.summary.views - Number(removed?.views || 0)),
            clicks: Math.max(0, current.summary.clicks - Number(removed?.clicks || 0)),
            reach: Math.max(0, current.summary.reach - Number(removed?.reach || 0)),
          },
          items: current.items.filter(
            (item) => !(item.contentType === 'service' && item.contentId === String(deleteServiceId)),
          ),
        };
      });

      setDeleteServiceId(null);
      setModal('none');
    } catch (error) {
      console.error('Delete service error:', error);
      setApiError(
        'Could not delete service. Make sure the Local API is running.',
      );
      alert(
        'Could not delete service. Please check the Local API.',
      );
    } finally {
      setApiLoading(false);
    }
  };

  /* =========================================================
     EXCHANGE
  ========================================================= */

  const updateExchange = (value: string) => {
    setExchangeDraft({
      currency: 'MYR → MMK',
      rate: value,
    });
  };

  const openExchangePreview = () => {
    setModal('exchangePreview');
  };

  const confirmExchange = async () => {
    const rate = exchangeDraft.rate.trim();

    if (!rate) {
      alert('Please enter an exchange rate.');
      return;
    }

    if (!/^\d+(?:\.\d+)?$/.test(rate)) {
      alert('Please enter a valid exchange rate.');
      return;
    }

    try {
      setApiError('');
      setApiLoading(true);

      const response = await adminFetch(
        apiUrl('/api/exchange-rate'),
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            rate,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            'Could not save exchange rate.',
        );
      }

      const returnedRate =
        typeof result?.data?.rate === 'string' ||
        typeof result?.data?.rate === 'number'
          ? formatRate(result.data.rate)
          : formatRate(rate);

      const savedExchange: ExchangeItem = {
        currency: 'MYR → MMK',
        rate: returnedRate,
        updatedAt: typeof result?.data?.updatedAt === 'string' ? result.data.updatedAt : new Date().toISOString(),
      };

      setExchangeRate(savedExchange);
      setExchangeDraft(savedExchange);
      setModal('none');
    } catch (error) {
      console.error('[Admin API] Save exchange failed:', {
        baseUrl: API_BASE || '(missing)',
        endpoint: apiUrl('/api/exchange-rate'),
        method: 'PUT',
        body: { rate },
        error,
      });
      setApiError(
        'Could not save exchange rate. Check the API URL and backend logs.',
      );
      recordDiagnostic({
        level: 'error',
        source: 'Admin API',
        message: error instanceof Error ? error.message : String(error),
        detail: 'PUT /api/exchange-rate',
      });
      alert(
        'Could not save exchange rate. Please check the Local API.',
      );
    } finally {
      setApiLoading(false);
    }
  };

  const updateExchangeProvider = (
    id: string,
    patch: Partial<ExchangeProviderItem>,
  ) => {
    setExchangeProviderDrafts((current) =>
      current.map((provider) =>
        provider.id === id ? { ...provider, ...patch } : provider,
      ),
    );
  };

  const addExchangeProvider = () => {
    if (exchangeProviderDrafts.length >= 2) {
      alert('A maximum of two comparison providers is supported.');
      return;
    }

    const id = `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setExchangeProviderDrafts((current) => [
      ...current,
      {
        id,
        name: '',
        rate: '',
        logoUrl: '',
        websiteUrl: '',
        published: true,
        displayOrder: current.length,
      },
    ]);
  };

  const selectExchangeProviderLogo = (id: string, file?: File | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Use a JPEG, PNG, or WebP provider logo.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('Provider logo must be 2 MB or smaller.');
      return;
    }

    const previousPreview = exchangeProviderLogoPreviews[id];
    if (previousPreview?.startsWith('blob:')) URL.revokeObjectURL(previousPreview);

    setExchangeProviderLogoFiles((current) => ({ ...current, [id]: file }));
    setExchangeProviderLogoPreviews((current) => ({
      ...current,
      [id]: URL.createObjectURL(file),
    }));
  };

  const removeExchangeProviderLogo = (id: string) => {
    const preview = exchangeProviderLogoPreviews[id];
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);

    setExchangeProviderLogoFiles((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    setExchangeProviderLogoPreviews((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
    updateExchangeProvider(id, { logoUrl: '' });
  };

  const saveExchangeProvider = async (provider: ExchangeProviderItem) => {
    const name = provider.name.trim();
    const rate = provider.rate.trim().replace(/,/g, '');
    const websiteUrl = provider.websiteUrl.trim();

    if (!name) {
      alert('Please enter a provider name.');
      return;
    }
    if (!/^\d+(?:\.\d+)?$/.test(rate) || Number(rate) <= 0) {
      alert('Please enter a valid provider rate greater than zero.');
      return;
    }
    if (websiteUrl) {
      try {
        const parsedUrl = new URL(websiteUrl);
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        alert('Provider website must be a valid HTTP or HTTPS URL.');
        return;
      }
    }

    const isNew = provider.id.startsWith('new-');
    const savedProvider = exchangeProviders.find((item) => item.id === provider.id);
    const formData = new FormData();
    formData.append('name', name);
    formData.append('rate', rate);
    formData.append('websiteUrl', websiteUrl);
    formData.append('published', String(provider.published));
    formData.append('displayOrder', String(provider.displayOrder));
    formData.append(
      'removeLogo',
      String(Boolean(savedProvider?.logoUrl && !provider.logoUrl && !exchangeProviderLogoFiles[provider.id])),
    );
    const logoFile = exchangeProviderLogoFiles[provider.id];
    if (logoFile) formData.append('logo', logoFile);

    try {
      setApiError('');
      setApiLoading(true);
      const result = await readApiResponse<Record<string, unknown>>(
        await adminFetch(
          apiUrl(isNew ? '/api/exchange-providers' : `/api/exchange-providers/${provider.id}`),
          {
            method: isNew ? 'POST' : 'PUT',
            body: formData,
          },
        ),
      );
      const saved = normalizeExchangeProvider(result.data);
      const replaceProvider = (current: ExchangeProviderItem[]) => [
        ...current.filter((item) => item.id !== provider.id),
        saved,
      ].sort((left, right) => left.displayOrder - right.displayOrder);

      setExchangeProviders(replaceProvider);
      setExchangeProviderDrafts(replaceProvider);

      const preview = exchangeProviderLogoPreviews[provider.id];
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
      setExchangeProviderLogoFiles((current) => {
        const next = { ...current };
        delete next[provider.id];
        return next;
      });
      setExchangeProviderLogoPreviews((current) => {
        const next = { ...current };
        delete next[provider.id];
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save comparison provider.';
      setApiError(message);
      alert(message);
    } finally {
      setApiLoading(false);
    }
  };

  const deleteExchangeProvider = async (provider: ExchangeProviderItem) => {
    if (provider.id.startsWith('new-')) {
      removeExchangeProviderLogo(provider.id);
      setExchangeProviderDrafts((current) => current.filter((item) => item.id !== provider.id));
      return;
    }
    if (!window.confirm(`Remove ${provider.name || 'this provider'} from the comparison?`)) return;

    try {
      setApiLoading(true);
      await readApiResponse<{ id: string }>(
        await adminFetch(apiUrl(`/api/exchange-providers/${provider.id}`), { method: 'DELETE' }),
      );
      setExchangeProviders((current) => current.filter((item) => item.id !== provider.id));
      setExchangeProviderDrafts((current) => current.filter((item) => item.id !== provider.id));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete comparison provider.';
      setApiError(message);
      alert(message);
    } finally {
      setApiLoading(false);
    }
  };

  /* =========================================================
     DASHBOARD
  ========================================================= */

  const renderDashboard = () => {
    const publishedNews = news.filter((item) => item.published);
    const publishedServices = services.filter((item) => item.published);

    const today = new Date();
    const activityDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - (6 - index));

      const nextDate = new Date(date);
      nextDate.setDate(date.getDate() + 1);

      const count = publishedNews.filter((item) => {
        const itemDate = new Date(item.date);
        return (
          !Number.isNaN(itemDate.getTime()) &&
          itemDate >= date &&
          itemDate < nextDate
        );
      }).length;

      return {
        count,
        label: date.toLocaleDateString('en-GB', {
          month: 'short',
          day: 'numeric',
        }),
      };
    });

    const maxActivity = Math.max(1, ...activityDays.map((day) => day.count));
    const chartPoints = activityDays
      .map((day, index) => {
        const x = index * (700 / 6);
        const y = 132 - (day.count / maxActivity) * 96;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    const chartAreaPoints = `0,144 ${chartPoints} 700,144`;

    return (
      <div className="dashboard-v4">
        <section className="dashboard-hero-v4">
          <div>
            <span className="dashboard-kicker-v4">SAGAWA CONTROL CENTER</span>
            <h1>
              Welcome back, {currentUser.name || 'Administrator'} <span aria-hidden="true">👋</span>
            </h1>
            <p>
              Monitor Sagawa content, publishing status and operational health from one secure workspace.
            </p>
          </div>

          <div className="dashboard-hero-meta-v4">
            <div className="dashboard-tagline-v4">
              Better Information
              <span>Stronger Community</span>
            </div>
            <div className="dashboard-date-v4">
              <span>
                {today.toLocaleDateString('en-GB', { weekday: 'long' })}
              </span>
              <strong>
                {today.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </strong>
              <small>Secure production workspace</small>
            </div>
          </div>
        </section>

        <section className="dashboard-stats-v4">
          <button className="dashboard-stat-v4" type="button" onClick={() => setActivePage('news')}>
            <span className="dashboard-stat-icon-v4 blue" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M6 3.8h10.8a2 2 0 0 1 2 2v12.4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z"/><path d="M8 8h7.5M8 11.5h7.5M8 15h5"/></svg>
            </span>
            <span className="dashboard-stat-copy-v4">
              <strong>Published News</strong>
              <small>Live in mobile app</small>
            </span>
            <span className="dashboard-stat-value-v4">{publishedNews.length}</span>
            <span className="dashboard-stat-arrow-v4" aria-hidden="true">›</span>
          </button>

          <button className="dashboard-stat-v4" type="button" onClick={() => setActivePage('services')}>
            <span className="dashboard-stat-icon-v4 green" aria-hidden="true">
              <svg viewBox="0 0 24 24"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </span>
            <span className="dashboard-stat-copy-v4">
              <strong>Services</strong>
              <small>Community directory</small>
            </span>
            <span className="dashboard-stat-value-v4">{publishedServices.length}</span>
            <span className="dashboard-stat-arrow-v4" aria-hidden="true">›</span>
          </button>

          <button className="dashboard-stat-v4" type="button" onClick={() => setActivePage('exchange')}>
            <span className="dashboard-stat-icon-v4 violet" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 8h13M15 5l3 3-3 3M19 16H6M9 13l-3 3 3 3"/></svg>
            </span>
            <span className="dashboard-stat-copy-v4">
              <strong>Exchange Rate</strong>
              <small>MYR → MMK reference</small>
            </span>
            <span className="dashboard-stat-value-v4 rate">
              {exchangeRate.rate ? formatRate(exchangeRate.rate) : 'Not set'}
            </span>
            <span className="dashboard-stat-arrow-v4" aria-hidden="true">›</span>
          </button>

          <button
            className="dashboard-stat-v4"
            type="button"
            onClick={() => void runHealthCheck()}
          >
            <span className={apiError ? 'dashboard-stat-icon-v4 red' : 'dashboard-stat-icon-v4 green'} aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M5 12.5l4 4L19 7"/></svg>
            </span>
            <span className="dashboard-stat-copy-v4">
              <strong>Admin API</strong>
              <small>Environment status</small>
            </span>
            <span className={apiError ? 'dashboard-health-pill-v4 issue' : 'dashboard-health-pill-v4'}>
              {apiError ? 'Attention' : 'Online'}
            </span>
            <span className="dashboard-stat-arrow-v4" aria-hidden="true">›</span>
          </button>
        </section>

        <section className="dashboard-performance-v4">
          <button type="button" onClick={() => setActivePage('analytics')}>
            <span className="metric-icon views">◉</span>
            <span><small>Total Views</small><strong>{analytics.summary.views.toLocaleString()}</strong></span>
          </button>
          <button type="button" onClick={() => setActivePage('analytics')}>
            <span className="metric-icon clicks">↗</span>
            <span><small>Total Clicks</small><strong>{analytics.summary.clicks.toLocaleString()}</strong></span>
          </button>
          <button type="button" onClick={() => setActivePage('analytics')}>
            <span className="metric-icon reach">◎</span>
            <span><small>Unique Reach</small><strong>{analytics.summary.reach.toLocaleString()}</strong></span>
          </button>
        </section>

        <section className="dashboard-middle-v4">
          <div className="dashboard-panel-v4 dashboard-chart-v4">
            <div className="dashboard-panel-header-v4">
              <div>
                <div className="dashboard-panel-title-v4">
                  <span className="panel-symbol-v4 blue" aria-hidden="true">▥</span>
                  <h2>Content Overview</h2>
                </div>
                <p>Published news activity over the last 7 days</p>
              </div>
              <span className="dashboard-range-v4">Last 7 days</span>
            </div>

            <div className="dashboard-chart-wrap-v4">
              <div className="dashboard-chart-y-v4" aria-hidden="true">
                <span>{maxActivity}</span>
                <span>{Math.max(1, Math.ceil(maxActivity / 2))}</span>
                <span>0</span>
              </div>
              <div className="dashboard-chart-canvas-v4">
                <svg viewBox="0 0 700 150" preserveAspectRatio="none" role="img" aria-label="Published news activity during the last seven days">
                  <defs>
                    <linearGradient id="dashboardActivityFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#268cff" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#268cff" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  <line x1="0" x2="700" y1="36" y2="36" className="dashboard-grid-line-v4" />
                  <line x1="0" x2="700" y1="84" y2="84" className="dashboard-grid-line-v4" />
                  <line x1="0" x2="700" y1="132" y2="132" className="dashboard-grid-line-v4" />
                  <polygon points={chartAreaPoints} fill="url(#dashboardActivityFill)" />
                  <polyline points={chartPoints} className="dashboard-chart-line-v4" />
                  {activityDays.map((day, index) => {
                    const x = index * (700 / 6);
                    const y = 132 - (day.count / maxActivity) * 96;
                    return (
                      <circle
                        key={day.label}
                        cx={x}
                        cy={y}
                        r="4"
                        className="dashboard-chart-point-v4"
                      />
                    );
                  })}
                </svg>
                <div className="dashboard-chart-labels-v4">
                  {activityDays.map((day) => <span key={day.label}>{day.label}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-panel-v4 dashboard-system-v4">
            <div className="dashboard-panel-header-v4">
              <div className="dashboard-panel-title-v4">
                <span className="panel-symbol-v4 green" aria-hidden="true">⌁</span>
                <h2>System Status</h2>
              </div>
              <button className="dashboard-text-button-v4" type="button" onClick={() => void runHealthCheck()}>
                Run check →
              </button>
            </div>

            <div className="dashboard-status-list-v4">
              <div><span><i className={apiError ? 'issue' : ''} />API Server</span><strong>{apiError ? 'Attention' : 'Online'}</strong></div>
              <div><span><i className={backendHealth === 'error' ? 'issue' : backendHealth === 'checking' ? 'syncing' : ''} />Database / Backend</span><strong>{backendHealth === 'error' ? 'Error' : backendHealth === 'checking' ? 'Checking' : 'Connected'}</strong></div>
              <div><span><i />Secure Session</span><strong>Authenticated</strong></div>
              <div><span><i className={apiLoading ? 'syncing' : ''} />Content Sync</span><strong>{apiLoading ? 'Syncing' : 'Ready'}</strong></div>
              <div><span><i className={API_BASE ? '' : 'issue'} />Environment</span><strong>{API_BASE ? 'Configured' : 'Missing URL'}</strong></div>
            </div>
          </div>
        </section>

        <section className="dashboard-bottom-v4">
          <div className="dashboard-panel-v4 dashboard-latest-v4">
            <div className="dashboard-panel-header-v4">
              <div>
                <div className="dashboard-panel-title-v4">
                  <span className="panel-symbol-v4 blue" aria-hidden="true">▤</span>
                  <h2>Latest News</h2>
                </div>
                <p>Recently managed news across the platform</p>
              </div>
              <button className="dashboard-outline-button-v4" type="button" onClick={() => setActivePage('news')}>
                View All →
              </button>
            </div>

            <div className="dashboard-news-list-v4">
              {news.slice(0, 2).map((item) => {
                const previewImage = item.mediaType === 'video'
                  ? item.thumbnailUrl || item.imageUrl
                  : item.imageUrl;
                return (
                  <article className="dashboard-news-row-v4" key={item.id}>
                    <div className="dashboard-news-thumb-v4">
                      {previewImage ? (
                        <img src={mediaUrl(previewImage)} alt="" />
                      ) : (
                        <span aria-hidden="true">▤</span>
                      )}
                    </div>
                    <div className="dashboard-news-copy-v4">
                      <div>
                        <strong>{item.title}</strong>
                        <span className={item.published ? 'published' : 'draft'}>
                          {item.published ? 'Published' : 'Draft'}
                        </span>
                      </div>
                      <p>{item.description || 'No description added yet.'}</p>
                      <small>
                        {item.date || 'Date not set'} · {item.views.toLocaleString()} views · {item.clicks.toLocaleString()} clicks · {item.reach.toLocaleString()} reach
                      </small>
                    </div>
                    <button className="dashboard-edit-button-v4" type="button" onClick={() => openEditNews(item)}>
                      Edit
                    </button>
                  </article>
                );
              })}
              {news.length === 0 && (
                <div className="dashboard-empty-v4">
                  <span aria-hidden="true">▤</span>
                  <div>
                    <strong>No news yet</strong>
                    <p>Create your first news item to see it here.</p>
                  </div>
                  <button type="button" onClick={openAddNews}>Add News</button>
                </div>
              )}
            </div>
          </div>

          <div className="dashboard-panel-v4 dashboard-quick-v4">
            <div className="dashboard-panel-header-v4">
              <div>
                <div className="dashboard-panel-title-v4">
                  <span className="panel-symbol-v4 violet" aria-hidden="true">ϟ</span>
                  <h2>Quick Actions</h2>
                </div>
                <p>Jump directly into common admin tasks</p>
              </div>
            </div>

            <div className="dashboard-quick-grid-v4">
              <button className="blue" type="button" onClick={openAddNews}><span>＋</span>Add News</button>
              <button className="green" type="button" onClick={openAddService}><span>＋</span>Add Service</button>
              <button className="violet dashboard-quick-wide-v4" type="button" onClick={() => setActivePage('exchange')}><span>↻</span>Update Rate</button>
            </div>
          </div>

          <div className="dashboard-panel-v4 dashboard-rate-v4">
            <div className="dashboard-panel-header-v4">
              <div className="dashboard-panel-title-v4">
                <span className="panel-symbol-v4 violet" aria-hidden="true">↔</span>
                <h2>Exchange Rate</h2>
              </div>
              <button className="dashboard-outline-button-v4" type="button" onClick={() => setActivePage('exchange')}>
                View All →
              </button>
            </div>

            <div className="dashboard-rate-card-v4">
              <div className="dashboard-rate-flags-v4">
                <span aria-hidden="true">🇲🇾</span>
                <span aria-hidden="true">🇲🇲</span>
                <strong>MYR → MMK</strong>
                <button type="button" onClick={() => setActivePage('exchange')} aria-label="Update exchange rate">↻</button>
              </div>
              <strong className="dashboard-rate-value-v4">
                {exchangeRate.rate ? formatRate(exchangeRate.rate) : 'Not set'}
              </strong>
              <small>Last updated: {exchangeRate.updatedAt || 'Not available'}</small>
            </div>

            <div className="dashboard-rate-note-v4">
              <span aria-hidden="true">i</span>
              <p>This is a reference rate for information and educational purposes only.</p>
            </div>
          </div>
        </section>

        <details className="dashboard-diagnostics-v4" open={Boolean(apiError)}>
          <summary>
            <span>
              <strong>Runtime & API diagnostics</strong>
              <small>{diagnostics.length ? `${diagnostics.length} event${diagnostics.length === 1 ? '' : 's'} captured` : 'No runtime errors captured'}</small>
            </span>
            <span aria-hidden="true">⌄</span>
          </summary>

          <div className="dashboard-diagnostics-body-v4">
            <div className="diagnostic-summary">
              <div><span>Frontend</span><strong>Loaded</strong></div>
              <div><span>Admin API</span><strong>{apiError ? 'Error' : 'Connected'}</strong></div>
              <div><span>Backend / DB</span><strong>{backendHealth === 'healthy' ? 'Healthy' : backendHealth === 'error' ? 'Error' : 'Checking'}</strong></div>
              <div><span>Session</span><strong>Authenticated</strong></div>
            </div>

            {passkeyMessage && (
              <div className={passkeyMessage.startsWith('Passkey registered') ? 'diagnostic-notice success' : 'diagnostic-notice error'}>
                <strong>Passkey</strong>
                <span>{passkeyMessage}</span>
              </div>
            )}

            <div className="diagnostic-log">
              {diagnostics.length === 0 ? (
                <div className="diagnostic-empty">
                  <span className="console-prompt">✓</span>
                  <div>
                    <strong>No runtime errors captured</strong>
                    <small>If the frontend, API, authentication or backend fails, the exact message will appear here.</small>
                  </div>
                </div>
              ) : diagnostics.slice(0, 6).map((item) => (
                <div className={`diagnostic-row ${item.level}`} key={item.id}>
                  <span className="diagnostic-time">{item.createdAt}</span>
                  <span className="diagnostic-source">{item.source}</span>
                  <code>{item.message}</code>
                  {item.detail && <small>{item.detail}</small>}
                </div>
              ))}
            </div>
          </div>
        </details>
      </div>
    );
  };

  /* =========================================================
     NEWS PAGE
  ========================================================= */

  const renderNewsPage = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            CONTENT MANAGEMENT
          </span>

          <h1>News</h1>

          <p>
            Create, review and publish trusted information for the Sagawa community.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openAddNews}
        >
          <span>+</span>
          Add News
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span>⌕</span>

          <input
            value={searchNews}
            onChange={(event) =>
              setSearchNews(
                event.target.value
              )
            }
            placeholder="Search news..."
          />

          {searchNews && (
            <button
              className="clear-button"
              onClick={() =>
                setSearchNews('')
              }
            >
              ×
            </button>
          )}
        </div>

        <span className="toolbar-count">
          {filteredNews.length} articles
        </span>
      </div>

      <div className="content-panel">
        <div className="panel-header">
          <div>
            <strong>
              All News
            </strong>

            <span>
              Maximum 10 displayed in mobile app
            </span>
          </div>

          <span className="soft-badge">
            {news.length} total
          </span>
        </div>

        <div className="news-list">
          {filteredNews.length === 0 ? (
            <div className="empty-state">
              <strong>
                No news found
              </strong>

              <span>
                Try another search or add
                a new article.
              </span>
            </div>
          ) : (
            filteredNews.map((item) => (
              <div
                className="news-card"
                key={item.id}
              >
                {(item.mediaType === 'video' ? item.thumbnailUrl : item.imageUrl) ? (
                  <div className="news-card-media">
                    <img
                      src={mediaUrl(item.mediaType === 'video' ? item.thumbnailUrl : item.imageUrl)}
                      alt=""
                    />
                    {item.mediaType === 'video' && <span className="media-play-badge">▶</span>}
                  </div>
                ) : (
                  <div className="media-placeholder" aria-label="No media">No media</div>
                )}

                <div className="news-card-main">
                  <div className="news-card-title-row">
                    <strong>
                      {item.title}
                    </strong>

                    <button
                      className={
                        item.published
                          ? 'status-badge published'
                          : 'status-badge draft'
                      }
                      onClick={() =>
                        toggleNewsPublished(
                          item.id
                        )
                      }
                    >
                      ●{' '}
                      {item.published
                        ? 'Published'
                        : 'Draft'}
                    </button>
                  </div>

                  <p>
                    {item.description}
                  </p>

                  <span className="news-date">
                    {item.date}
                  </span>
                  <div className="content-metrics-inline">
                    <span>◉ {item.views.toLocaleString()} views</span>
                    <span>↗ {item.clicks.toLocaleString()} clicks</span>
                    <span>◎ {item.reach.toLocaleString()} reach</span>
                  </div>
                </div>

                <div className="card-actions">
                  <button
                    className="icon-action"
                    onClick={() => {
                      setPreviewNews(item);
                      setModal(
                        'newsPreview'
                      );
                    }}
                    title="Preview"
                  >
                    👁
                  </button>

                  <button
                    className="icon-action"
                    onClick={() =>
                      openEditNews(item)
                    }
                    title="Edit"
                  >
                    ✎
                  </button>

                  <button
                    className="icon-action danger"
                    onClick={() =>
                      askDeleteNews(item.id)
                    }
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  /* =========================================================
     SERVICES PAGE
  ========================================================= */

  const renderServicesPage = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            SERVICE MANAGEMENT
          </span>

          <h1>Services</h1>

          <p>
            Manage useful community services and keep their information accurate and up to date.
          </p>
        </div>

        <button
          className="primary-button"
          disabled={services.length >= 25}
          onClick={openAddService}
        >
          <span>+</span>
          Add Service
        </button>
      </div>

      <div className="toolbar">
        <div className="search-box">
          <span>⌕</span>

          <input
            value={searchServices}
            onChange={(event) =>
              setSearchServices(
                event.target.value
              )
            }
            placeholder="Search services..."
          />

          {searchServices && (
            <button
              className="clear-button"
              onClick={() =>
                setSearchServices('')
              }
            >
              ×
            </button>
          )}
        </div>

        <span className="toolbar-count">
          {services.length}/25 services
        </span>
      </div>

      <div className="content-panel">
        <div className="panel-header">
          <div>
            <strong>
              All Services
            </strong>

            <span>
              Review publishing status, contact details and service information.
            </span>
          </div>

          <span className="soft-badge">
            {services.length}/25
          </span>
        </div>

        <div className="service-grid">
          {filteredServices.length === 0 ? (
            <div className="empty-state">
              <strong>
                No services found
              </strong>

              <span>
                Try another search or add
                a service.
              </span>
            </div>
          ) : (
            filteredServices.map((item) => (
              <div
                className="service-card"
                key={item.id}
              >
                <div className="service-image-wrap">
                  {item.image ? (
                    <img src={item.image} alt="" />
                  ) : (
                    <div className="media-placeholder" aria-label="No image">No image</div>
                  )}

                  <span
                    className={
                      item.published
                        ? 'image-status live'
                        : 'image-status'
                    }
                  >
                    {item.published
                      ? 'LIVE'
                      : 'DRAFT'}
                  </span>
                </div>

                <div className="service-card-body">
                  <div className="service-title-row">
                    <strong>
                      {item.title}
                    </strong>

                    <span>
                      {item.location}
                    </span>
                  </div>

                  <p>
                    {item.description}
                  </p>

                  <div className="content-metrics-inline">
                    <span>◉ {Number(item.views || 0).toLocaleString()} views</span>
                    <span>↗ {Number(item.clicks || 0).toLocaleString()} clicks</span>
                    <span>◎ {Number(item.reach || 0).toLocaleString()} reach</span>
                  </div>

                  <div className="service-card-footer">
                    <button
                      className="small-action"
                      onClick={() => {
                        setPreviewService(
                          item
                        );

                        setModal(
                          'servicePreview'
                        );
                      }}
                    >
                      Preview
                    </button>

                    <button
                      className="small-action"
                      onClick={() =>
                        openEditService(item)
                      }
                    >
                      Edit
                    </button>

                    <button
                      className="small-action danger-text"
                      onClick={() =>
                        askDeleteService(
                          item.id
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );

  /* =========================================================
     EXCHANGE PAGE
  ========================================================= */

  const renderExchangePage = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            FINANCIAL CONTENT
          </span>

          <h1>Exchange Rate</h1>

          <p>
            Publish the Sagawa reference rate and manage the trusted providers shown for comparison.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openExchangePreview}
          disabled={apiLoading}
        >
          Review Changes
        </button>
      </div>

      <div className="exchange-panel">
        <div className="exchange-header">
          <div>
            <strong>
              MYR → MMK
            </strong>

            <span>
              1 Malaysian Ringgit to Myanmar Kyat
            </span>
          </div>

          <span className="soft-badge">
            Admin controlled
          </span>
        </div>

        <div className="exchange-table">
          <div className="exchange-table-head">
            <span>PAIR</span>
            <span>NAME</span>
            <span>RATE</span>
          </div>

          <div className="exchange-row">
            <strong>
              {exchangeDraft.currency}
            </strong>

            <span>
              Malaysian Ringgit
            </span>

            <input
              value={exchangeDraft.rate}
              onChange={(event) =>
                updateExchange(
                  event.target.value,
                )
              }
              inputMode="decimal"
              aria-label="MYR to MMK exchange rate"
            />
          </div>
        </div>

        <div className="exchange-footer">
          <span>
            Current saved rate: 1 MYR ={' '}
            {exchangeRate.rate} MMK
          </span>

          <button
            className="primary-button"
            onClick={openExchangePreview}
            disabled={apiLoading}
          >
            Preview & Confirm
          </button>
        </div>
      </div>

      <div className="exchange-panel provider-rate-panel">
        <div className="exchange-header provider-rate-header">
          <div>
            <strong>Trusted provider comparison</strong>
            <span>Up to two published providers appear in the mobile Exchange hero.</span>
          </div>

          <button
            className="secondary-button"
            type="button"
            onClick={addExchangeProvider}
            disabled={apiLoading || exchangeProviderDrafts.length >= 2}
          >
            + Add provider
          </button>
        </div>

        <div className="provider-admin-list">
          {exchangeProviderDrafts.length === 0 ? (
            <div className="provider-empty-state">
              <strong>No comparison providers yet</strong>
              <span>Add a provider, rate, and optional logo to enable the mobile comparison section.</span>
            </div>
          ) : exchangeProviderDrafts.map((provider, index) => {
            const logoPreview = exchangeProviderLogoPreviews[provider.id] || mediaUrl(provider.logoUrl);

            return (
              <article className="provider-editor-card" key={provider.id}>
                <div className="provider-editor-heading">
                  <div className="provider-logo-editor">
                    <div className="provider-logo-preview">
                      {logoPreview ? (
                        <img src={logoPreview} alt={`${provider.name || 'Provider'} logo`} />
                      ) : (
                        <span>{(provider.name || 'P').slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>

                    <div className="provider-logo-actions">
                      <label className="upload-button provider-upload-button">
                        Upload logo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(event) =>
                            selectExchangeProviderLogo(provider.id, event.target.files?.[0])}
                        />
                      </label>
                      {logoPreview && (
                        <button
                          className="small-action danger-text"
                          type="button"
                          onClick={() => removeExchangeProviderLogo(provider.id)}
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>

                  <span className={provider.published ? 'status-badge published' : 'status-badge draft'}>
                    {provider.published ? 'Visible' : 'Hidden'}
                  </span>
                </div>

                <div className="provider-fields-grid">
                  <label>
                    Provider name
                    <input
                      value={provider.name}
                      maxLength={80}
                      onChange={(event) =>
                        updateExchangeProvider(provider.id, { name: event.target.value })}
                      placeholder="e.g. Merchanttrade"
                    />
                  </label>

                  <label>
                    MYR → MMK rate
                    <input
                      value={provider.rate}
                      inputMode="decimal"
                      onChange={(event) =>
                        updateExchangeProvider(provider.id, { rate: event.target.value })}
                      placeholder="1076.50"
                    />
                  </label>

                  <label className="provider-website-field">
                    Provider website (optional)
                    <input
                      value={provider.websiteUrl}
                      inputMode="url"
                      onChange={(event) =>
                        updateExchangeProvider(provider.id, { websiteUrl: event.target.value })}
                      placeholder="https://provider.example"
                    />
                  </label>

                  <label>
                    Position
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={provider.displayOrder}
                      onChange={(event) =>
                        updateExchangeProvider(provider.id, {
                          displayOrder: Number(event.target.value) || 0,
                        })}
                    />
                  </label>
                </div>

                <div className="provider-editor-footer">
                  <label className="provider-publish-toggle">
                    <input
                      type="checkbox"
                      checked={provider.published}
                      onChange={(event) =>
                        updateExchangeProvider(provider.id, { published: event.target.checked })}
                    />
                    Show in mobile app
                  </label>

                  <div>
                    <button
                      className="small-action danger-text"
                      type="button"
                      onClick={() => deleteExchangeProvider(provider)}
                      disabled={apiLoading}
                    >
                      Delete
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => saveExchangeProvider({ ...provider, displayOrder: provider.displayOrder ?? index })}
                      disabled={apiLoading}
                    >
                      {apiLoading ? 'Saving…' : 'Save provider'}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </>
  );

  /* =========================================================
     NEWS FORM MODAL
  ========================================================= */

  const renderNewsFormModal = () => (
    <div className="modal-overlay">
      <div className="modal-card large-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {editingNewsId
                ? 'EDIT NEWS'
                : 'NEW NEWS'}
            </span>

            <h2>
              {editingNewsId
                ? 'Edit News'
                : 'Create News'}
            </h2>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
            aria-label="Close news form"
          >
            ×
          </button>
        </div>

        <div className="form-section">
          <label>
            News Title
          </label>

          <input
            className="form-input"
            value={newsTitle}
            onChange={(event) =>
              setNewsTitle(
                event.target.value
              )
            }
            placeholder="Enter news title"
            autoComplete="off"
          />

          <label>
            Description
          </label>

          <textarea
            className="form-textarea"
            value={newsDescription}
            onChange={(event) =>
              setNewsDescription(
                event.target.value
              )
            }
            placeholder="Write your news description..."
            rows={6}
          />
        </div>

        <div className="media-type-selector" role="group" aria-label="News media type">
          <button
            type="button"
            className={newsMediaType === 'image' ? 'active' : ''}
            onClick={() => setNewsMediaType('image')}
          >
            Image news
          </button>
          <button
            type="button"
            className={newsMediaType === 'video' ? 'active' : ''}
            onClick={() => setNewsMediaType('video')}
          >
            Video news
          </button>
        </div>

        <div className="media-grid">
          {newsMediaType === 'image' && <div className="upload-card">
            <div className="upload-card-top">
              <div>
                <strong>
                  News Image
                </strong>

                <span>
                  JPG, PNG, WEBP
                </span>
              </div>

              <span className="upload-symbol">
                🖼️
              </span>
            </div>

            <label className="upload-button">
              Choose Image

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={
                  handleNewsImage
                }
              />
            </label>

            {newsImagePreview && (
              <div className="preview-media">
                <img
                  src={newsImagePreview}
                  alt="News preview"
                />

                <button
                  type="button"
                  onClick={() => {
                    setNewsImageFile(null);
                    revokeObjectUrl(newsImagePreview);
                    setNewsImagePreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {newsImageFile && (
              <small>
                Selected: {newsImageFile.name}
              </small>
            )}
          </div>}

          {newsMediaType === 'video' && <>
          <div className="upload-card">
            <div className="upload-card-top">
              <div>
                <strong>
                  News Video
                </strong>

                <span>
                  MP4, MOV, WEBM · max 100 MB
                </span>
              </div>

              <span className="upload-symbol">
                🎬
              </span>
            </div>

            <label className="upload-button">
              Choose Video

              <input
                type="file"
                accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
                onChange={
                  handleNewsVideo
                }
              />
            </label>

            {newsVideoPreview && (
              <div className="preview-media">
                <video
                  src={newsVideoPreview}
                  controls
                  preload="metadata"
                />

                <button
                  type="button"
                  onClick={() => {
                    setNewsVideoFile(null);
                    revokeObjectUrl(newsVideoPreview);
                    setNewsVideoPreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            )}

            {newsVideoFile && (
              <small>
                Selected: {newsVideoFile.name}
              </small>
            )}
          </div>
          <div className="upload-card">
            <div className="upload-card-top">
              <div>
                <strong>Video Thumbnail</strong>
                <span>Required · JPG, PNG, WEBP</span>
              </div>
              <span className="upload-symbol">🖼️</span>
            </div>
            <label className="upload-button">
              Choose Thumbnail
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleNewsThumbnail}
              />
            </label>
            {newsThumbnailPreview && (
              <div className="preview-media">
                <img src={newsThumbnailPreview} alt="Video thumbnail preview" />
                <button
                  type="button"
                  onClick={() => {
                    setNewsThumbnailFile(null);
                    revokeObjectUrl(newsThumbnailPreview);
                    setNewsThumbnailPreview('');
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            {newsThumbnailFile && <small>Selected: {newsThumbnailFile.name}</small>}
          </div>
          </>}
        </div>

        <div className="publish-setting">
          <div>
            <strong>
              Publish status
            </strong>

            <span>
              Published content appears
              in the mobile app.
            </span>
          </div>

          <button
            type="button"
            className={
              newsPublished
                ? 'toggle active'
                : 'toggle'
            }
            onClick={() =>
              setNewsPublished(
                !newsPublished
              )
            }
          >
            <span />
          </button>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={closeModal}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={
              previewNewsDraft
            }
          >
            Preview Changes →
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================
     NEWS PREVIEW
  ========================================================= */

  const renderNewsPreviewModal = () => (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              REVIEW BEFORE SAVING
            </span>

            <h2>
              News Preview
            </h2>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
            aria-label="Close news preview"
          >
            ×
          </button>
        </div>

        {previewNews && (
          <>
            <div className="review-banner">
              <span>✓</span>

              <div>
                <strong>
                  Review your changes
                </strong>

                <small>
                  Nothing has been saved yet.
                </small>
              </div>
            </div>

            {previewNews.mediaType === 'image' && previewNews.imageUrl && (
              <img
                className="large-preview-image"
                src={previewNews.imageUrl}
                alt=""
              />
            )}

            {previewNews.mediaType === 'video' && previewNews.thumbnailUrl && (
              <div className="large-video-thumbnail">
                <img src={previewNews.thumbnailUrl} alt="Video thumbnail" />
                <span>▶</span>
              </div>
            )}

            <div className="preview-content">
              <div className="preview-status-row">
                <span>
                  NEWS
                </span>

                <span
                  className={
                    previewNews.published
                      ? 'status-badge published'
                      : 'status-badge draft'
                  }
                >
                  {previewNews.published
                    ? 'Published'
                    : 'Draft'}
                </span>
              </div>

              <h3>
                {previewNews.title}
              </h3>

              <p>
                {previewNews.description}
              </p>

              {previewNews.mediaType === 'video' && previewNews.videoUrl && (
                <video
                  className="large-preview-video"
                  src={previewNews.videoUrl}
                  controls
                  preload="metadata"
                />
              )}
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setModal('newsForm')
                }
              >
                ← Back & Edit
              </button>

              <button
                className="confirm-button"
                onClick={
                  confirmNews
                }
                disabled={apiLoading}
              >
                {apiLoading ? 'Saving...' : '✓ Confirm & Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* =========================================================
     NEWS DELETE
  ========================================================= */

  const renderNewsDeleteModal = () => {
    const item = news.find(
      (newsItem) =>
        newsItem.id === deleteNewsId
    );

    return (
      <div className="modal-overlay">
        <div className="modal-card confirm-modal">
          <div className="danger-circle">
            🗑
          </div>

          <span className="eyebrow">
            DESTRUCTIVE ACTION
          </span>

          <h2>
            Delete this news?
          </h2>

          <p>
            You are about to delete
            <strong>
              {' '}
              “{item?.title}”
            </strong>
            .
          </p>

          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              className="danger-button"
              onClick={
                confirmDeleteNews
              }
              disabled={apiLoading}
            >
              {apiLoading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* =========================================================
     SERVICE FORM
  ========================================================= */

  const renderServiceFormModal = () => (
    <div className="modal-overlay">
      <div className="modal-card large-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              {editingServiceId
                ? 'EDIT SERVICE'
                : 'NEW SERVICE'}
            </span>

            <h2>
              {editingServiceId
                ? 'Edit Service'
                : 'Create Service'}
            </h2>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
            aria-label="Close service form"
          >
            ×
          </button>
        </div>

        <div className="form-section">
          <label>
            Service Title
          </label>

          <input
            className="form-input"
            value={serviceTitle}
            onChange={(event) =>
              setServiceTitle(
                event.target.value
              )
            }
            placeholder="Enter service title"
            autoComplete="off"
          />

          <label>
            Description
          </label>

          <textarea
            className="form-textarea"
            value={serviceDescription}
            onChange={(event) =>
              setServiceDescription(
                event.target.value
              )
            }
            placeholder="Describe this service..."
            rows={5}
          />

          <div className="two-column-form">
            <div>
              <label>
                Phone
              </label>

              <input
                className="form-input"
                value={servicePhone}
                onChange={(event) =>
                  setServicePhone(
                    event.target.value
                  )
                }
                placeholder="+60..."
                autoComplete="off"
              />
            </div>

            <div>
              <label>
                Location
              </label>

              <input
                className="form-input"
                value={serviceLocation}
                onChange={(event) =>
                  setServiceLocation(
                    event.target.value
                  )
                }
                placeholder="Malaysia"
                autoComplete="off"
              />
            </div>
          </div>

          <label>
            Website
          </label>

          <input
            className="form-input"
            value={serviceWebsite}
            onChange={(event) =>
              setServiceWebsite(
                event.target.value
              )
            }
            placeholder="https://..."
            autoComplete="off"
          />
        </div>

        <div className="upload-card">
          <div className="upload-card-top">
            <div>
              <strong>
                Service Image
              </strong>

              <span>
                JPG, PNG, WEBP
              </span>
            </div>

            <span className="upload-symbol">
              🖼️
            </span>
          </div>

          <label className="upload-button">
            Choose Image

            <input
              type="file"
              accept="image/*"
              onChange={
                handleServiceImage
              }
            />
          </label>

          {serviceImagePreview && (
            <div className="preview-media">
              <img
                src={serviceImagePreview}
                alt="Service preview"
              />

              <button
                type="button"
                onClick={() => {
                  setServiceImagePreview('');
                  setServiceImageName('');
                }}
              >
                Remove
              </button>
            </div>
          )}

          {serviceImageName && (
            <small>
              Selected: {serviceImageName}
            </small>
          )}
        </div>

        <div className="publish-setting">
          <div>
            <strong>
              Publish status
            </strong>

            <span>
              Published services appear
              in the mobile app.
            </span>
          </div>

          <button
            type="button"
            className={
              servicePublished
                ? 'toggle active'
                : 'toggle'
            }
            onClick={() =>
              setServicePublished(
                !servicePublished
              )
            }
          >
            <span />
          </button>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={closeModal}
          >
            Cancel
          </button>

          <button
            className="primary-button"
            onClick={
              previewServiceDraft
            }
          >
            Preview Changes →
          </button>
        </div>
      </div>
    </div>
  );

  /* =========================================================
     SERVICE PREVIEW
  ========================================================= */

  const renderServicePreviewModal = () => (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              REVIEW BEFORE SAVING
            </span>

            <h2>
              Service Preview
            </h2>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
            aria-label="Close service preview"
          >
            ×
          </button>
        </div>

        {previewService && (
          <>
            <div className="review-banner">
              <span>✓</span>

              <div>
                <strong>
                  Review your changes
                </strong>

                <small>
                  Nothing has been saved yet.
                </small>
              </div>
            </div>

            <img
              className="large-preview-image"
              src={previewService.image}
              alt=""
            />

            <div className="preview-content">
              <div className="preview-status-row">
                <span>
                  SERVICE
                </span>

                <span
                  className={
                    previewService.published
                      ? 'status-badge published'
                      : 'status-badge draft'
                  }
                >
                  {previewService.published
                    ? 'Published'
                    : 'Draft'}
                </span>
              </div>

              <h3>
                {previewService.title}
              </h3>

              <p>
                {previewService.description}
              </p>

              <div className="detail-list">
                {previewService.phone && (
                  <div>
                    <span>
                      Phone
                    </span>

                    <strong>
                      {previewService.phone}
                    </strong>
                  </div>
                )}

                {previewService.website && (
                  <div>
                    <span>
                      Website
                    </span>

                    <strong>
                      {previewService.website}
                    </strong>
                  </div>
                )}

                {previewService.location && (
                  <div>
                    <span>
                      Location
                    </span>

                    <strong>
                      {previewService.location}
                    </strong>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() =>
                  setModal('serviceForm')
                }
              >
                ← Back & Edit
              </button>

              <button
                className="confirm-button"
                onClick={
                  confirmService
                }
                disabled={apiLoading}
              >
                {apiLoading ? 'Saving...' : '✓ Confirm & Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );

  /* =========================================================
     SERVICE DELETE
  ========================================================= */

  const renderServiceDeleteModal = () => {
    const item = services.find(
      (service) =>
        service.id === deleteServiceId
    );

    return (
      <div className="modal-overlay">
        <div className="modal-card confirm-modal">
          <div className="danger-circle">
            🗑
          </div>

          <span className="eyebrow">
            DESTRUCTIVE ACTION
          </span>

          <h2>
            Delete this service?
          </h2>

          <p>
            You are about to delete
            <strong>
              {' '}
              “{item?.title}”
            </strong>
            .
          </p>

          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={closeModal}
            >
              Cancel
            </button>

            <button
              className="danger-button"
              onClick={
                confirmDeleteService
              }
              disabled={apiLoading}
            >
              {apiLoading ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* =========================================================
     EXCHANGE PREVIEW
  ========================================================= */

  const renderExchangePreviewModal = () => (
    <div className="modal-overlay">
      <div className="modal-card preview-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">
              REVIEW BEFORE SAVING
            </span>

            <h2>
              Exchange Rate Preview
            </h2>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={closeModal}
            aria-label="Close exchange preview"
          >
            ×
          </button>
        </div>

        <div className="review-banner">
          <span>✓</span>

          <div>
            <strong>
              Review exchange rate change
            </strong>

            <small>
              Nothing has been saved yet.
            </small>
          </div>
        </div>

        <div className="rate-review">
          <div
            className="rate-review-row"
            key={exchangeDraft.currency}
          >
            <div>
              <strong>
                {exchangeDraft.currency}
              </strong>

              <span>
                Malaysian Ringgit to Myanmar Kyat
              </span>
            </div>

            <div className="rate-values">
              <div>
                <small>
                  CURRENT
                </small>

                <span>
                  {exchangeRate.rate}
                </span>

                <b>
                  →
                </b>

                <strong>
                  {exchangeDraft.rate}
                </strong>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button
            className="secondary-button"
            onClick={closeModal}
          >
            ← Back & Edit
          </button>

          <button
            className="confirm-button"
            onClick={confirmExchange}
            disabled={apiLoading}
          >
            {apiLoading
              ? 'Saving...'
              : '✓ Confirm & Save'}
          </button>
        </div>
      </div>
    </div>
  );

  const renderAnalyticsPage = () => {
    const publishedItems = analytics.items.filter((item) => item.published);
    const topByViews = [...publishedItems].sort((a, b) => b.views - a.views);

    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">CONTENT PERFORMANCE</span>
            <h1>Analytics</h1>
            <p>
              See views, clicks and unique reach for every published news article and service.
            </p>
          </div>
        </div>

        <section className="analytics-summary-grid">
          <div className="analytics-summary-card">
            <span className="metric-icon views">◉</span>
            <div><small>Total Views</small><strong>{analytics.summary.views.toLocaleString()}</strong></div>
          </div>
          <div className="analytics-summary-card">
            <span className="metric-icon clicks">↗</span>
            <div><small>Total Clicks</small><strong>{analytics.summary.clicks.toLocaleString()}</strong></div>
          </div>
          <div className="analytics-summary-card">
            <span className="metric-icon reach">◎</span>
            <div><small>Unique Reach</small><strong>{analytics.summary.reach.toLocaleString()}</strong></div>
          </div>
        </section>

        <div className="content-panel analytics-panel">
          <div className="panel-header">
            <div>
              <strong>Published Content Performance</strong>
              <span>Deleted content is automatically removed from this report.</span>
            </div>
            <span className="soft-badge">{publishedItems.length} items</span>
          </div>

          {topByViews.length === 0 ? (
            <div className="empty-state">
              <strong>No analytics yet</strong>
              <span>Views and clicks will appear after users open published news or services.</span>
            </div>
          ) : (
            <div className="analytics-table-wrap">
              <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Content</th>
                    <th>Type</th>
                    <th>Views</th>
                    <th>Clicks</th>
                    <th>Reach</th>
                    <th>CTR</th>
                  </tr>
                </thead>
                <tbody>
                  {topByViews.map((item) => {
                    const ctr = item.views > 0 ? (item.clicks / item.views) * 100 : 0;
                    return (
                      <tr key={`${item.contentType}-${item.contentId}`}>
                        <td>
                          <strong>{item.title || 'Untitled content'}</strong>
                          <small>{item.contentId}</small>
                        </td>
                        <td>
                          <span className={item.contentType === 'news' ? 'analytics-type news' : 'analytics-type service'}>
                            {item.contentType === 'news' ? 'News' : 'Service'}
                          </span>
                        </td>
                        <td>{item.views.toLocaleString()}</td>
                        <td>{item.clicks.toLocaleString()}</td>
                        <td>{item.reach.toLocaleString()}</td>
                        <td>{ctr.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </>
    );
  };

  /* =========================================================
     PAGE
  ========================================================= */

  const renderPage = () => {
    switch (activePage) {
      case 'news':
        return renderNewsPage();

      case 'services':
        return renderServicesPage();

      case 'exchange':
        return renderExchangePage();

      case 'analytics':
        return renderAnalyticsPage();

      default:
        return renderDashboard();
    }
  };

  /* =========================================================
     APP
  ========================================================= */

  if (authenticated === null) {
    return <main className="login-shell"><p>Checking secure session...</p></main>;
  }

  if (!authenticated) {
    return <LoginScreen onAuthenticated={(user) => {
      setCurrentUser(normalizeCurrentUser(user));
      setAuthenticated(true);
    }} />;
  }

  return (
    <div className="admin-app">
      {showAdminProfile && (
        <div className="modal-overlay">
          <div className="modal-card compact-modal admin-profile-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">ADMIN PROFILE</span>
                <h2>Profile</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setShowAdminProfile(false)} aria-label="Close admin profile">
                ×
              </button>
            </div>

            <div className="admin-profile-editor">
              <label className="admin-photo-picker">
                {adminProfileAvatarPreview ? (
                  <img src={adminProfileAvatarPreview} alt="Admin profile" />
                ) : (
                  <span>{(adminProfileName || 'A').slice(0, 1).toUpperCase()}</span>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => handleAdminProfilePhoto(event.target.files?.[0])}
                />
                <small>Change photo</small>
              </label>

              <div className="login-field">
                <label htmlFor="admin-profile-name">Admin name</label>
                <input
                  id="admin-profile-name"
                  type="text"
                  maxLength={80}
                  value={adminProfileName}
                  onChange={(event) => setAdminProfileName(event.target.value)}
                  autoComplete="off"
                />
              </div>

              <div className="admin-profile-email">
                <span>Email</span>
                <strong>{currentUser.email || 'Configured admin email'}</strong>
              </div>

              {adminProfileError && <div className="login-error" role="alert">{adminProfileError}</div>}
            </div>

            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setShowAdminProfile(false)}>Cancel</button>
              <button className="primary-button" type="button" onClick={saveAdminProfile} disabled={adminProfileSaving}>
                {adminProfileSaving ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPasswordChange && (
        <div className="modal-overlay">
          <div className="modal-card compact-modal">
            <div className="modal-heading">
              <div>
                <span className="eyebrow">SECURITY</span>
                <h2>Change Password</h2>
              </div>
              <button className="modal-close" type="button" onClick={() => setShowPasswordChange(false)} aria-label="Close change password modal">
                ×
              </button>
            </div>

            <div className="password-change-stack">
              <div className="password-field">
                <label htmlFor="current-password">Current password</label>
                <div className="password-input-wrap">
                  <input id="current-password" type={showCurrentPassword ? 'text' : 'password'} value={passwordChangeForm.currentPassword} onChange={(event) => setPasswordChangeForm((current) => ({ ...current, currentPassword: event.target.value }))} autoComplete="current-password" />
                  <button type="button" className="password-toggle small" onClick={() => setShowCurrentPassword((current) => !current)} aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}>
                    {showCurrentPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="password-field">
                <label htmlFor="new-password">New password</label>
                <div className="password-input-wrap">
                  <input id="new-password" type={showNewPassword ? 'text' : 'password'} value={passwordChangeForm.newPassword} onChange={(event) => setPasswordChangeForm((current) => ({ ...current, newPassword: event.target.value }))} autoComplete="new-password" />
                  <button type="button" className="password-toggle small" onClick={() => setShowNewPassword((current) => !current)} aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}>
                    {showNewPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <div className="password-field">
                <label htmlFor="confirm-password">Confirm new password</label>
                <div className="password-input-wrap">
                  <input id="confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={passwordChangeForm.confirmPassword} onChange={(event) => setPasswordChangeForm((current) => ({ ...current, confirmPassword: event.target.value }))} autoComplete="new-password" />
                  <button type="button" className="password-toggle small" onClick={() => setShowConfirmPassword((current) => !current)} aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}>
                    {showConfirmPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <ul className="password-policy-list">
                <li>At least 12 characters</li>
                <li>One lowercase letter</li>
                <li>One uppercase letter</li>
                <li>One number</li>
                <li>One special character</li>
              </ul>

              {passwordChangeError && <div className="login-error" role="alert">{passwordChangeError}</div>}
              {passwordChangeSuccess && <div className="login-success" role="status">{passwordChangeSuccess}</div>}
            </div>

            <div className="modal-actions">
              <button className="secondary-button" type="button" onClick={() => setShowPasswordChange(false)}>
                Close
              </button>
              <button className="primary-button" type="button" onClick={submitPasswordChange} disabled={passwordChangeLoading}>
                {passwordChangeLoading ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        </div>
      )}

      <aside className="sidebar">
        <div className="brand">
          <img
            src="/sagawa-flower-logo.svg"
            alt="Sagawa"
            className="brand-logo-image"
          />

          <div>
            <strong>
              Sagawa
            </strong>

            <span>
              Control Center
            </span>
          </div>
        </div>

        <nav className="navigation">
          <span className="nav-label">
            CONTENT
          </span>

          {menuItems.map((item) => (
            <button
              key={item.id}
              className={
                activePage === item.id
                  ? 'nav-item active'
                  : 'nav-item'
              }
              onClick={() =>
                setActivePage(item.id)
              }
            >
              <span className="nav-icon">
                {item.icon}
              </span>

              <span>
                {item.label}
              </span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            className="nav-item"
            type="button"
            onClick={() => setShowPasswordChange(true)}
          >
            <span className="nav-icon">
              ⚙
            </span>

            <span>
              Change Password
            </span>
          </button>

          <div className="admin-user admin-user-button sidebar-account-summary-v4">
            <div className="user-avatar">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt="" />
              ) : (
                (currentUser.name || 'A').slice(0, 1).toUpperCase()
              )}
            </div>

            <div>
              <strong>
                {currentUser.name || 'Administrator'}
              </strong>

              <span>
                Secure admin account
              </span>
            </div>
          </div>

          <button className="nav-item logout-button" type="button" onClick={logout}>
            <span className="nav-icon">↪</span>
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="admin-global-search-v4">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              aria-label="Search Sagawa content"
              placeholder="Search news and services..."
              value={activePage === 'services' ? searchServices : activePage === 'news' ? searchNews : ''}
              onChange={(event) => {
                const value = event.target.value;
                if (activePage === 'services') {
                  setSearchServices(value);
                } else {
                  setSearchNews(value);
                  if (activePage !== 'news') setActivePage('news');
                }
              }}
            />
            <span>⌘ K</span>
          </div>

          <div className="topbar-actions">
            <span className={apiError ? 'topbar-health-v4 issue' : 'topbar-health-v4'}>
              <i />
              {apiError ? 'Needs attention' : apiLoading ? 'Syncing' : 'Operational'}
            </span>

            <button
              className="secondary-button topbar-passkey-button"
              type="button"
              onClick={registerPasskey}
              disabled={passkeyBusy}
            >
              <svg className="topbar-fingerprint-v4" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 11a2 2 0 0 0-2 2c0 3.6-1.2 5.8-2.5 7" />
                <path d="M14.8 19.5c.8-1.7 1.2-3.9 1.2-6.5a4 4 0 0 0-8 0c0 1.7-.2 3-.7 4.3" />
                <path d="M18.6 18.1c.3-1.5.4-3.2.4-5.1a7 7 0 0 0-14 0c0 .8 0 1.5-.1 2.2" />
                <path d="M20.8 9.5A9.2 9.2 0 0 0 4 7.2" />
              </svg>
              {passkeyBusy ? 'Registering…' : 'Register Passkey'}
            </button>

            <button
              className="profile-button"
              type="button"
              onClick={openAdminProfile}
              aria-label="Open admin profile"
              title="Admin profile"
            >
              <span className="profile-avatar">
                {currentUser.avatarUrl ? (
                  <img src={currentUser.avatarUrl} alt="" />
                ) : (
                  (currentUser.name || 'A').slice(0, 1).toUpperCase()
                )}
              </span>

              <span className="topbar-profile-copy-v4">
                <strong>{currentUser.name || 'Admin'}</strong>
                <small>Admin</small>
              </span>

              <span className="profile-signout">⌄</span>
            </button>
          </div>
        </header>

        <section className="content">
          {apiError && (
            <div className="admin-warning-banner" role="alert">
              <span className="warning-symbol">!</span>
              <div>
                <strong>Admin API needs attention</strong>
                <small>{apiError}</small>
              </div>
              <button type="button" onClick={() => setActivePage('dashboard')}>Open diagnostics</button>
            </div>
          )}

          {apiLoading && (
            <div
              style={{
                marginBottom: 12,
                color: '#667085',
                fontSize: 13,
              }}
            >
              Syncing Sagawa admin data…
            </div>
          )}

          {renderPage()}
        </section>

        <footer className="admin-footer-v4">
          <span>© 2026 Sagawa Control Center. All rights reserved.</span>
          <div>
            <span>Privacy</span>
            <i />
            <span>Terms</span>
            <i />
            <span>Support</span>
          </div>
        </footer>
      </main>

      {modal === 'newsForm' &&
        renderNewsFormModal()}

      {modal === 'newsPreview' &&
        renderNewsPreviewModal()}

      {modal === 'newsDelete' &&
        renderNewsDeleteModal()}

      {modal === 'serviceForm' &&
        renderServiceFormModal()}

      {modal === 'servicePreview' &&
        renderServicePreviewModal()}

      {modal === 'serviceDelete' &&
        renderServiceDeleteModal()}

      {modal === 'exchangePreview' &&
        renderExchangePreviewModal()}
    </div>
  );
}

export default App;

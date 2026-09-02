import React, { useEffect, useMemo, useState } from 'react';
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';

import './App.css';
import { API_BASE, apiUrl } from './config/api';


type Page = 'dashboard' | 'news' | 'services' | 'exchange';

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
  id: number;
  title: string;
  description: string;
  image: string;
  video: string;
  published: boolean;
  date: string;
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
};

type ExchangeItem = {
  currency: 'MYR → MMK';
  rate: string;
};

const initialNews: NewsItem[] = [
  {
    id: 1,
    title: 'Malaysia–Myanmar Community Update',
    description:
      'Latest useful information and updates for the Malaysia–Myanmar community.',
    image:
      'https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=85',
    video: '',
    published: true,
    date: '24 Aug 2026',
  },
  {
    id: 2,
    title: 'Important Community Information',
    description:
      'Important information and useful updates for Myanmar people living in Malaysia.',
    image:
      'https://images.unsplash.com/photo-1521292270410-a8c4d716d518?auto=format&fit=crop&w=1200&q=85',
    video: '',
    published: true,
    date: '23 Aug 2026',
  },
];

const initialServices: ServiceItem[] = [
  {
    id: 1,
    title: 'Healthcare Services',
    description:
      'Find useful healthcare information and services for the Malaysia–Myanmar community.',
    image:
      'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=85',
    imageName: 'healthcare.jpg',
    phone: '+60 00-000 0000',
    website: 'https://example.com',
    location: 'Malaysia',
    published: true,
  },
  {
    id: 2,
    title: 'Jobs & Employment',
    description:
      'Discover job opportunities and useful employment resources.',
    image:
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',
    imageName: 'jobs.jpg',
    phone: '',
    website: '',
    location: 'Malaysia',
    published: true,
  },
];




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

const initialExchange: ExchangeItem = {
  currency: 'MYR → MMK',
  rate: '1053',
};

type LoginScreenProps = {
  onAuthenticated: (user?: Partial<CurrentUser> | null) => void;
};

type CurrentUser = {
  name: string;
  email: string;
};

type ApiResult<T> = {
  success: true;
  message?: string;
  data: T;
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

type LoginStep = 'credentials' | 'forgotPassword' | 'resetPassword';

function LoginScreen({ onAuthenticated }: LoginScreenProps) {
  const [step, setStep] = useState<LoginStep>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [passkeyAvailable] = useState(
    () => typeof window !== 'undefined' && 'PublicKeyCredential' in window,
  );

  // Forgot password step state
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetStep, setResetStep] = useState<'request' | 'verify' | 'newpassword'>('request');

  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordIsPresent = password.length > 0;
  const submitDisabled = loading || !emailIsValid || !passwordIsPresent;

  const handlePasswordLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!emailIsValid || !passwordIsPresent) {
      setError('Please enter a valid email and password.');
      return;
    }

    setLoading(true);
    setError('');

   try {
     const result = await readApiResponse<{
       authenticated?: boolean;
       user?: Partial<CurrentUser> | null;
     }>(await fetch(apiUrl('/api/auth/login'), {
       method: 'POST',
       credentials: 'include',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password }),
     }));

     setError('');
     onAuthenticated(result.data?.user ?? null);
   } catch (_err) {
     setError('Invalid email or password. Please try again.');
   } finally {
     setLoading(false);
   }
 };

  const handlePasskeyLogin = async () => {
    if (loading) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const optionsResult = await readApiResponse<PublicKeyCredentialRequestOptionsJSON>(await fetch(
        apiUrl('/api/auth/passkey/authentication-options'),
        { method: 'POST', credentials: 'include' },
      ));
      const response = await startAuthentication({
        optionsJSON: optionsResult.data as any,
      });
      const result = await readApiResponse<{
        authenticated?: boolean;
        user?: Partial<CurrentUser> | null;
      }>(await fetch(apiUrl('/api/auth/passkey/authentication'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }));
      onAuthenticated(result.data?.user ?? null);
    } catch {
      setError('Unable to sign in with passkey. Please try again.');
    } finally {
      setLoading(false);
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
        body: JSON.stringify({ email: forgotEmail }),
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

    setLoading(true);
    setError('');
    setResetStep('newpassword');
    setLoading(false);
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
      alert('Password reset successful. Please sign in with your new password.');
    } catch (_err) {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderLoginShell = (title: string, subtitle: string, children: React.ReactNode) => (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand login-brand">
          <div className="brand-mark">MM</div>
          <div><strong>Sagawa</strong><span>Admin</span></div>
        </div>
        <span className="eyebrow">SECURE ADMIN ACCESS</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  );

  if (step === 'credentials') {
    return renderLoginShell('Welcome back', 'Sign in to manage Malay MM content.', (
      <>
        <form onSubmit={handlePasswordLogin} noValidate>
          <label htmlFor="admin-email">Email</label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-invalid={email.length > 0 && !emailIsValid}
            disabled={loading}
            placeholder="admin@example.com"
          />

          <label htmlFor="admin-password">Password</label>
          <div className="password-input-container">
            <input
              id="admin-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={loading}
              placeholder="••••••••"
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
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          {error && <div className="login-error" role="alert">{error}</div>}

          <button className="primary-button login-button" type="submit" disabled={submitDisabled}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <button
          className="secondary-button passkey-button"
          type="button"
          onClick={handlePasskeyLogin}
          disabled={loading || !passkeyAvailable}
        >
          {passkeyAvailable ? 'Sign in with Fingerprint / Touch ID' : 'Passkeys not supported on this device'}
        </button>

        <button
          className="secondary-button reset-button"
          type="button"
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
      </>
    ));
  }

  if (step === 'forgotPassword') {
    if (resetStep === 'request') {
      return renderLoginShell('Reset password', 'Enter your email address to receive a password reset code.', (
        <>
          <form onSubmit={handleForgotPasswordRequest} noValidate>
            <label htmlFor="forgot-email">Email</label>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={forgotEmail}
              onChange={(event) => setForgotEmail(event.target.value)}
              required
              disabled={loading}
              placeholder="admin@example.com"
            />

            {error && <div className="login-error" role="alert">{error}</div>}

            <button className="primary-button login-button" type="submit" disabled={loading || !forgotEmail}>
              {loading ? 'Sending...' : 'Send reset code'}
            </button>
          </form>

          <button
            className="secondary-button reset-button"
            type="button"
            onClick={() => {
              setStep('credentials');
              setForgotEmail('');
              setError('');
            }}
            disabled={loading}
          >
            Back to sign in
          </button>
        </>
      ));
    }

    if (resetStep === 'verify') {
      return renderLoginShell('Verify reset code', 'Enter the code sent to your email.', (
        <>
          <form onSubmit={handleResetPasswordVerify} noValidate>
            <label htmlFor="reset-code">6-Digit Code</label>
            <input
              id="reset-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={resetCode}
              onChange={(event) => setResetCode(event.target.value.replace(/\D/g, ''))}
              required
              disabled={loading}
              placeholder="000000"
              autoComplete="one-time-code"
            />

            {error && <div className="login-error" role="alert">{error}</div>}

            <button
              className="primary-button login-button"
              type="submit"
              disabled={loading || resetCode.length !== 6}
            >
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </form>

          <button
            className="secondary-button reset-button"
            type="button"
            onClick={() => {
              setResetStep('request');
              setResetCode('');
              setError('');
            }}
            disabled={loading}
          >
            Back to request code
          </button>
        </>
      ));
    }

    if (resetStep === 'newpassword') {
      return renderLoginShell('Create new password', 'Set a strong new password for your account.', (
        <>
          <form onSubmit={handleResetPasswordSubmit} noValidate>
            <label htmlFor="new-password">New Password</label>
            <div className="password-input-container">
              <input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
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
                {showNewPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>

            <label htmlFor="confirm-password">Confirm Password</label>
            <div className="password-input-container">
              <input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                disabled={loading}
                placeholder="••••••••"
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
                {showConfirmPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>

            <ul className="password-policy-list">
              <li style={{ color: newPassword.length >= 12 ? '#16a34a' : '#667085' }}>At least 12 characters</li>
              <li style={{ color: /[a-z]/.test(newPassword) ? '#16a34a' : '#667085' }}>One lowercase letter</li>
              <li style={{ color: /[A-Z]/.test(newPassword) ? '#16a34a' : '#667085' }}>One uppercase letter</li>
              <li style={{ color: /\d/.test(newPassword) ? '#16a34a' : '#667085' }}>One number</li>
              <li style={{ color: /[^A-Za-z0-9]/.test(newPassword) ? '#16a34a' : '#667085' }}>One special character</li>
            </ul>

            {error && <div className="login-error" role="alert">{error}</div>}

            <button className="primary-button login-button" type="submit" disabled={loading || newPassword !== confirmPassword || newPassword.length < 12}>
              {loading ? 'Resetting...' : 'Reset password'}
            </button>
          </form>

          <button
            className="secondary-button reset-button"
            type="button"
            onClick={() => {
              setStep('credentials');
              setForgotEmail('');
              setResetCode('');
              setNewPassword('');
              setConfirmPassword('');
              setResetStep('request');
              setError('');
            }}
            disabled={loading}
          >
            Back to sign in
          </button>
        </>
      ));
    }
  }

  return null;
}

const adminFetch = (input: RequestInfo | URL, init: RequestInit = {}) =>
  fetch(input, { ...init, credentials: 'include' });

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser>({
    name: 'Admin',
    email: '',
  });
  const normalizeCurrentUser = (user?: Partial<CurrentUser> | null): CurrentUser => ({
    name: typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : 'Admin',
    email: typeof user?.email === 'string' ? user.email : '',
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

  const [searchNews, setSearchNews] =
    useState('');

  const [searchServices, setSearchServices] =
    useState('');

  const [editingNewsId, setEditingNewsId] =
    useState<number | null>(null);

  const [editingServiceId, setEditingServiceId] =
    useState<number | null>(null);

  const [deleteNewsId, setDeleteNewsId] =
    useState<number | null>(null);

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

  const [newsImageFile, setNewsImageFile] =
    useState<File | null>(null);

  const [newsImagePreview, setNewsImagePreview] =
    useState('');

  const [newsVideoFile, setNewsVideoFile] =
    useState<File | null>(null);

  const [newsVideoPreview, setNewsVideoPreview] =
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

  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
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

  useEffect(() => {
    void adminFetch(apiUrl('/api/auth/me'))
      .then((response) => readApiResponse<{ authenticated?: boolean; user?: Partial<CurrentUser> | null }>(response))
      .then((result) => {
        const nextUser = normalizeCurrentUser(result.data?.user ?? null);
        setCurrentUser(nextUser);
        setAuthenticated(Boolean(result.data?.authenticated));
      })
      .catch((error) => {
        console.error('[Admin Auth] Session check failed:', error);
        setCurrentUser({ name: 'Admin', email: '' });
        setAuthenticated(false);
      });
  }, []);

  const logout = async () => {
    try {
      await adminFetch(apiUrl('/api/auth/logout'), { method: 'POST' });
    } finally {
      setCurrentUser({ name: 'Admin', email: '' });
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
      setCurrentUser({ name: 'Admin', email: '' });
      setAuthenticated(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Password change failed.';
      setPasswordChangeError(message);
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  const registerPasskey = async () => {
    try {
      const optionsResult = await readApiResponse<PublicKeyCredentialCreationOptionsJSON>(await adminFetch(
        apiUrl('/api/auth/passkey/registration-options'),
        { method: 'POST' },
      ));
      const response = await startRegistration({
        optionsJSON: optionsResult.data as any,
      });
      await readApiResponse(await adminFetch(apiUrl('/api/auth/passkey/registration'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(response),
      }));
      alert('Passkey registered successfully.');
    } catch (error) {
      console.error('[Admin Auth] Passkey registration failed:', error);
      alert(error instanceof Error ? error.message : 'Could not register passkey.');
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

      const [newsResponse, servicesResponse, exchangeResponse] =
        await Promise.all([
          adminFetch(apiUrl('/api/news')),
          adminFetch(apiUrl('/api/services')),
          adminFetch(apiUrl('/api/exchange-rate')),
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

      const newsResult = await newsResponse.json();
      const servicesResult = await servicesResponse.json();
      const exchangeResult = await exchangeResponse.json();

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

      let loadedRate = '';

      if (
        typeof rawExchange?.rate === 'string' ||
        typeof rawExchange?.rate === 'number'
      ) {
        loadedRate = String(rawExchange.rate);
      } else if (Array.isArray(rawExchange?.rates)) {
        const myrRate = rawExchange.rates.find(
          (item: Partial<ExchangeItem> & {
            buy?: string | number;
            sell?: string | number;
          }) => item.currency === 'MYR → MMK',
        );

        loadedRate = String(
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

        loadedRate = String(
          myrRate?.rate ??
            myrRate?.buy ??
            myrRate?.sell ??
            '',
        );
      }

      if (!cancelled) {
        setNews(newsResult.data);
        setServices(servicesResult.data.slice(0, 25));

        if (
          loadedRate &&
          loadedRate !== 'undefined'
        ) {
          const loadedExchange: ExchangeItem = {
            currency: 'MYR → MMK',
            rate: loadedRate,
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
}, [authenticated]);

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
    setEditingNewsId(null);

    setNewsTitle('');
    setNewsDescription('');
    setNewsPublished(true);

    setNewsImageFile(null);
    setNewsImagePreview('');

    setNewsVideoFile(null);
    setNewsVideoPreview('');

    setModal('newsForm');
  };

  const openEditNews = (item: NewsItem) => {
    setEditingNewsId(item.id);

    setNewsTitle(item.title);
    setNewsDescription(item.description);
    setNewsPublished(item.published);

    setNewsImageFile(null);
    setNewsImagePreview(item.image);

    setNewsVideoFile(null);
    setNewsVideoPreview(item.video);

    setModal('newsForm');
  };

  const handleNewsImage = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);

      setNewsImageFile(file);
      setNewsImagePreview(dataUrl);
    } catch (error) {
      console.error('Image read error:', error);
      alert('Could not read the selected image.');
    }
  };

  const handleNewsVideo = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('video/')) {
      alert('Please choose a video file.');
      event.target.value = '';
      return;
    }

    try {
      const dataUrl = await fileToDataUrl(file);

      setNewsVideoFile(file);
      setNewsVideoPreview(dataUrl);
    } catch (error) {
      console.error('Video read error:', error);
      alert('Could not read the selected video.');
    }
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

    const existingNews = editingNewsId
      ? news.find(
          (item) => item.id === editingNewsId
        )
      : undefined;

    const draft: NewsItem = {
      id: editingNewsId ?? Date.now(),

      title,

      description,

      image:
        newsImagePreview ||
        'https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=85',

      video: newsVideoPreview,

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

      const response = await adminFetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewNews),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Could not save news.'
        );
      }

      const savedItem = result.data as NewsItem;

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

      setApiError(
        'Could not save news. Make sure the Local API is running.'
      );
      alert(
        'Could not save news. Please check that the Local API is running.'
      );
    } finally {
      setApiLoading(false);
    }
  };

  const askDeleteNews = (id: number) => {
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

  const toggleNewsPublished = async (id: number) => {
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
            ? result.data
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
      image:
        serviceImagePreview ||
        'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1200&q=85',
      imageName: serviceImageName || 'service-image',
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
          ? String(result.data.rate)
          : rate;

      const savedExchange: ExchangeItem = {
        currency: 'MYR → MMK',
        rate: returnedRate,
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
      alert(
        'Could not save exchange rate. Please check the Local API.',
      );
    } finally {
      setApiLoading(false);
    }
  };

  /* =========================================================
     DASHBOARD
  ========================================================= */

  const renderDashboard = () => (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            MALAY MM ADMIN
          </span>

          <p className="welcome-message">
            Welcome, {currentUser.name || 'Admin'}
          </p>

          <h1>Dashboard</h1>

          <p>
            Manage your mobile app content
            from one secure place.
          </p>
        </div>

        <div className="admin-avatar">
          A
        </div>
      </div>

      <div className="stats-grid">
        <button
          className="stat-card"
          onClick={() =>
            setActivePage('news')
          }
        >
          <div className="stat-top">
            <div className="stat-icon blue">
              📰
            </div>

            <span className="stat-arrow">
              →
            </span>
          </div>

          <strong>News</strong>

          <span>
            Manage news content
          </span>

          <b>{news.length}</b>
        </button>

        <button
          className="stat-card"
          onClick={() =>
            setActivePage('services')
          }
        >
          <div className="stat-top">
            <div className="stat-icon green">
              🛠️
            </div>

            <span className="stat-arrow">
              →
            </span>
          </div>

          <strong>Services</strong>

          <span>
            Manage community services
          </span>

          <b>{services.length}/25</b>
        </button>

        <button
          className="stat-card"
          onClick={() =>
            setActivePage('exchange')
          }
        >
          <div className="stat-top">
            <div className="stat-icon purple">
              💱
            </div>

            <span className="stat-arrow">
              →
            </span>
          </div>

          <strong>Exchange Rate</strong>

          <span>
            Manage current rates
          </span>

          <b>Live</b>
        </button>
      </div>

      <div className="overview-card">
        <div>
          <span className="eyebrow">
            CONTENT STATUS
          </span>

          <h2>
            Current overview
          </h2>
        </div>

        <div className="overview-list">
          <div>
            <span>
              Published News
            </span>

            <strong>
              {
                news.filter(
                  (item) => item.published
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Published Services
            </span>

            <strong>
              {
                services.filter(
                  (item) => item.published
                ).length
              }
            </strong>
          </div>

          <div>
            <span>
              Current MYR → MMK
            </span>

            <strong>
              {exchangeRate.rate}
            </strong>
          </div>
        </div>
      </div>
    </>
  );

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
            Create, preview and manage
            mobile news.
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
                <img
                  src={item.image}
                  alt=""
                />

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
            Manage up to 25 services shown
            in the mobile app.
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
              No categories — simple content
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
                  <img
                    src={item.image}
                    alt=""
                  />

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
            Manage the current MYR to MMK exchange
            rate shown in the mobile app.
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
            onClick={closeModal}
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

        <div className="media-grid">
          <div className="upload-card">
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
                accept="image/*"
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
          </div>

          <div className="upload-card">
            <div className="upload-card-top">
              <div>
                <strong>
                  News Video
                </strong>

                <span>
                  MP4, MOV, WEBM
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
                accept="video/*"
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
            onClick={closeModal}
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

            {previewNews.image && (
              <img
                className="large-preview-image"
                src={previewNews.image}
                alt=""
              />
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

              {previewNews.video && (
                <video
                  className="large-preview-video"
                  src={previewNews.video}
                  controls
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
              >
                ✓ Confirm & Save
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
            >
              Confirm Delete
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
            onClick={closeModal}
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
            onClick={closeModal}
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
              >
                ✓ Confirm & Save
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
            >
              Confirm Delete
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
            onClick={closeModal}
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
          <div className="brand-mark">
            MM
          </div>

          <div>
            <strong>
              Sagawa
            </strong>

            <span>
              Admin
            </span>
          </div>
        </div>

        <nav className="navigation">
          <span className="nav-label">
            MANAGEMENT
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

          <div className="admin-user">
            <div className="user-avatar">
              A
            </div>

            <div>
              <strong>
                Administrator
              </strong>

              <span>
                Admin account
              </span>
            </div>
          </div>

          <button className="nav-item logout-button" type="button" onClick={logout}>
            <span className="nav-icon">↪</span>
            <span>Log out</span>
          </button>

          <button className="secondary-button passkey-manage-button" type="button" onClick={registerPasskey}>
            Register Fingerprint / Passkey
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="topbar-label">
              MALAY MM PROJECT
            </span>

            <span className="system-status">
              ● System ready
            </span>
          </div>

          <div className="topbar-actions">
            <button
              className="secondary-button topbar-passkey-button"
              type="button"
              onClick={registerPasskey}
            >
              Register Passkey
            </button>

            <button
              className="icon-button"
              type="button"
              aria-label="Notifications"
            >
              🔔
            </button>

            <button
              className="profile-button"
              type="button"
              onClick={logout}
              aria-label="Log out"
            >
              <span className="profile-avatar">
                A
              </span>

              <span>
                Admin
              </span>

              <span>
                ⌄
              </span>
            </button>
          </div>
        </header>

        <section className="content">
          {apiError && (
            <div
              className="review-banner"
              style={{
                marginBottom: 16,
                borderColor: '#f1c4c4',
                background: '#fff7f7',
              }}
            >
              <span>!</span>

              <div>
                <strong>Local API connection issue</strong>
                <small>{apiError}</small>
              </div>
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
              Saving / loading content…
            </div>
          )}

          {renderPage()}
        </section>
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

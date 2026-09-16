export type AuthStatus = 'anonymous' | 'authenticated' | 'refreshing';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface SessionUser {
  id: string;
  email?: string;
  preferredLanguage?: string | null;
}

export interface AuthSession {
  expiresAt: string | null;
  profileCompleted: boolean;
  user: SessionUser | null;
}

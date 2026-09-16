import { useCallback } from 'react';
import { create } from 'zustand';

import { AuthSession, AuthStatus, AuthTokens } from '@/features/auth/types';
import { queryClient } from '@/lib/query-client';
import { apiRequest } from '@/services/api/client';
import { clearTokens, getStoredTokens, saveTokens } from '@/services/auth/token-storage';

type AuthState = {
  hydrated: boolean;
  session: AuthSession | null;
  status: AuthStatus;
  clearSession: () => Promise<void>;
  hydrateSession: () => Promise<void>;
  markProfileCompleted: () => void;
  setSession: (session: AuthSession, tokens: AuthTokens) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  clearSession: async () => {
    await clearTokens();
    queryClient.clear();
    set({
      session: null,
      status: 'anonymous',
    });
  },
  hydrateSession: async () => {
    const tokens = await getStoredTokens();
    if (!tokens) {
      set({ hydrated: true, session: null, status: 'anonymous' });
      return;
    }

    set({ status: 'refreshing' });
    try {
      const response = await apiRequest<{
        success: boolean;
        data: {
          accessToken: string;
          refreshToken: string;
          expiresAt: string;
          profileCompleted: boolean;
          user: { id: string; email: string };
        };
      }>('/api/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      await saveTokens(response.data);
      set({
        hydrated: true,
        session: {
          expiresAt: response.data.expiresAt,
          profileCompleted: response.data.profileCompleted,
          user: response.data.user,
        },
        status: 'authenticated',
      });
    } catch {
      await clearTokens();
      queryClient.clear();
      set({ hydrated: true, session: null, status: 'anonymous' });
    }
  },
  hydrated: false,
  markProfileCompleted: () =>
    set((state) => ({
      session: state.session ? { ...state.session, profileCompleted: true } : state.session,
    })),
  session: null,
  setSession: async (session, tokens) => {
    queryClient.clear();
    await saveTokens(tokens);
    set({
      session,
      status: 'authenticated',
    });
  },
  status: 'anonymous',
}));

export function useHydrateAuthSession() {
  const hydrateSession = useAuthStore((state) => state.hydrateSession);

  return useCallback(async () => {
    await hydrateSession();
  }, [hydrateSession]);
}

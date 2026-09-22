import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { create } from 'zustand';

import { AuthSession, AuthStatus, AuthTokens } from '@/features/auth/types';
import { queryClient } from '@/lib/query-client';
import { apiRequest } from '@/services/api/client';
import { clearTokens, getStoredTokens, saveTokens } from '@/services/auth/token-storage';
import { useSettingsStore } from '@/store/settings-store';

const GUEST_MODE_KEY = 'auth.guestMode';

type AuthState = {
  hydrated: boolean;
  session: AuthSession | null;
  status: AuthStatus;
  clearSession: () => Promise<void>;
  continueAsGuest: () => Promise<void>;
  exitGuest: () => Promise<void>;
  hydrateSession: () => Promise<void>;
  markProfileCompleted: () => void;
  setSession: (session: AuthSession, tokens: AuthTokens) => Promise<void>;
};

async function clearGuestMode() {
  await AsyncStorage.removeItem(GUEST_MODE_KEY);
}

function applyLightThemeForOnboarding(profileCompleted: boolean) {
  if (!profileCompleted) {
    useSettingsStore.getState().setThemePreference('light');
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  clearSession: async () => {
    await Promise.all([clearTokens(), clearGuestMode()]);
    queryClient.clear();
    set({
      hydrated: true,
      session: null,
      status: 'anonymous',
    });
  },

  continueAsGuest: async () => {
    await clearTokens();
    await AsyncStorage.setItem(GUEST_MODE_KEY, '1');
    queryClient.clear();
    set({
      hydrated: true,
      session: null,
      status: 'guest',
    });
  },

  exitGuest: async () => {
    await clearGuestMode();
    queryClient.clear();
    set({
      hydrated: true,
      session: null,
      status: 'anonymous',
    });
  },

  hydrateSession: async () => {
    const tokens = await getStoredTokens();

    if (!tokens) {
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);
      set({
        hydrated: true,
        session: null,
        status: guestMode === '1' ? 'guest' : 'anonymous',
      });
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

      await Promise.all([saveTokens(response.data), clearGuestMode()]);
      applyLightThemeForOnboarding(response.data.profileCompleted);
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
      const guestMode = await AsyncStorage.getItem(GUEST_MODE_KEY);
      queryClient.clear();
      set({
        hydrated: true,
        session: null,
        status: guestMode === '1' ? 'guest' : 'anonymous',
      });
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
    await Promise.all([saveTokens(tokens), clearGuestMode()]);
    applyLightThemeForOnboarding(session.profileCompleted);
    set({
      hydrated: true,
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

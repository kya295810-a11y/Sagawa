import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { initializeI18n } from '@/locales';
import { initializeTokenStorage } from '@/services/auth/token-storage';
import { registerUnauthorizedHandler } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { AppThemeProvider, useAppTheme } from '@/theme/provider';

function ProviderEffects({ children }: PropsWithChildren) {
  const hydrated = useSettingsStore((state) => state.hydrated);
  const language = useSettingsStore((state) => state.languagePreference);
  const { theme } = useAppTheme();

  useEffect(() => {
    initializeTokenStorage();
    registerUnauthorizedHandler(() => useAuthStore.getState().clearSession());
  }, []);

  useEffect(() => {
    if (hydrated) {
      initializeI18n(language);
    }
  }, [hydrated, language]);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SafeAreaProvider>{children}</SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <AppThemeProvider>
        <ProviderEffects>{children}</ProviderEffects>
      </AppThemeProvider>
    </QueryClientProvider>
  );
}

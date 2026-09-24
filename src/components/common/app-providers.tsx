import { QueryClientProvider } from '@tanstack/react-query';
import { PropsWithChildren, useEffect } from 'react';
import { Alert, AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { queryClient } from '@/lib/query-client';
import { initializeI18n } from '@/locales';
import { initializeTokenStorage } from '@/services/auth/token-storage';
import { registerUnauthorizedHandler } from '@/services/api/client';
import { useAuthStore } from '@/store/auth-store';
import { useSettingsStore } from '@/store/settings-store';
import { AppThemeProvider, useAppTheme } from '@/theme/provider';
import { runScheduledCacheCleanup } from '@/services/storage/cache-maintenance';
import { checkForAppUpdate, openAppStoreUpdate } from '@/services/updates/app-update';

function ProviderEffects({ children }: PropsWithChildren) {
  const hydrated = useSettingsStore((state) => state.hydrated);
  const language = useSettingsStore((state) => state.languagePreference);
  const { theme } = useAppTheme();
  const autoUpdateEnabled = useSettingsStore((state) => state.autoUpdateEnabled);

  useEffect(() => {
    void runScheduledCacheCleanup().catch((error) => {
      console.warn('Scheduled cache cleanup unavailable:', error);
    });
    initializeTokenStorage();
    registerUnauthorizedHandler(() => useAuthStore.getState().clearSession());
  }, []);

  useEffect(() => {
    if (hydrated) {
      initializeI18n(language);
    }
  }, [hydrated, language]);

  useEffect(() => {
    if (!hydrated || !autoUpdateEnabled) return;

    const check = () => {
      void checkForAppUpdate(false)
        .then((result) => {
          if (!result?.available) return;

          Alert.alert(
            'Sagawa update available',
            `Version ${result.latestVersion} is ready.`,
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update',
                onPress: () => {
                  void openAppStoreUpdate(result.storeUrl).catch((error) => {
                    console.warn('App store update link unavailable:', error);
                  });
                },
              },
            ],
          );
        })
        .catch((error) => {
          console.warn('Automatic update check unavailable:', error);
        });
    };

    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => subscription.remove();
  }, [autoUpdateEnabled, hydrated]);

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

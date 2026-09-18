import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProviders } from '@/components/common/app-providers';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAppTheme } from '@/theme/provider';
import { useAuthStore } from '@/store/auth-store';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore repeated calls during Fast Refresh.
});

function RootNavigator() {
  const { theme } = useAppTheme();
  const status = useAuthStore((state) => state.status);
  const profileCompleted = useAuthStore((state) => state.session?.profileCompleted ?? false);
  const isAuthenticated = status === 'authenticated';

  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      <Stack
        screenOptions={{
          animation: theme.motion.navigationAnimation,
          contentStyle: {
            backgroundColor: theme.colors.background,
          },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={!isAuthenticated}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && !profileCompleted}>
          <Stack.Screen name="complete-profile" />
        </Stack.Protected>
        <Stack.Protected guard={isAuthenticated && profileCompleted}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="perdonal-information" />
          <Stack.Screen name="help-support" />
          <Stack.Screen name="about" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="terms" />
          <Stack.Screen name="news/[id]" />
          <Stack.Screen name="services/[id]" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

function AppBootstrapper() {
  const isReady = useAppBootstrap();

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {
        // Ignore splash hide race conditions during development.
      });
    }
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  return <RootNavigator />;
}

export default function RootLayout() {
  return (
    <AppProviders>
      <AppBootstrapper />
    </AppProviders>
  );
}

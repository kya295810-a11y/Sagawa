import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProviders } from '@/components/common/app-providers';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAppTheme } from '@/theme/provider';
import { useAuthStore } from '@/store/auth-store';
import { registerPushToken } from '@/services/notifications/push-token';
import { loadNotificationsModule } from '@/services/notifications/runtime';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Ignore repeated calls during Fast Refresh.
});

function RootNavigator() {
  const { theme } = useAppTheme();
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const profileCompleted = useAuthStore((state) => state.session?.profileCompleted ?? false);

  const isAuthenticated = status === 'authenticated';
  const isGuest = status === 'guest';
  const canUseApp = isGuest || (isAuthenticated && profileCompleted);

  useEffect(() => {
    if (!isAuthenticated || !profileCompleted) return;

    void registerPushToken().catch((error) => {
      console.warn('Push registration unavailable:', error);
    });
  }, [isAuthenticated, profileCompleted]);

  useEffect(() => {
    if (!canUseApp) return;

    let mounted = true;
    let subscription: { remove: () => void } | undefined;

    const setupPushNavigation = async () => {
      try {
        const Notifications = await loadNotificationsModule();

        if (!Notifications || !mounted) {
          return;
        }

        const openNotification = (response: import('expo-notifications').NotificationResponse) => {
          if (!mounted) return;

          const data = response.notification.request.content.data as
            Record<string, unknown> | undefined;

          const type = String(data?.type || '').toLowerCase();
          const newsId = data?.newsId ?? data?.news_id;
          const serviceId = data?.serviceId ?? data?.service_id;

          if (type === 'news' && (typeof newsId === 'string' || typeof newsId === 'number')) {
            router.push({
              pathname: '/news/[id]',
              params: { id: String(newsId) },
            });
            Notifications.clearLastNotificationResponse();
            return;
          }

          if (
            type === 'service' &&
            (typeof serviceId === 'string' || typeof serviceId === 'number')
          ) {
            router.push({
              pathname: '/services/[id]',
              params: { id: String(serviceId) },
            });
            Notifications.clearLastNotificationResponse();
            return;
          }

          if (type === 'exchange') {
            router.push('/(tabs)/exchange');
            Notifications.clearLastNotificationResponse();
          }
        };

        subscription = Notifications.addNotificationResponseReceivedListener(openNotification);

        const lastResponse = Notifications.getLastNotificationResponse();
        if (lastResponse) {
          openNotification(lastResponse);
        }
      } catch (error) {
        console.warn('Push navigation unavailable:', error);
      }
    };

    void setupPushNavigation();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [canUseApp, router]);

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

        <Stack.Protected guard={canUseApp}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="news/[id]" />
          <Stack.Screen name="services/[id]" />
        </Stack.Protected>

        <Stack.Protected guard={isAuthenticated && profileCompleted}>
          <Stack.Screen name="perdonal-information" />
          <Stack.Screen name="notification-settings" />
          <Stack.Screen name="biometric-settings" />
        </Stack.Protected>

        <Stack.Screen name="help-support" />
        <Stack.Screen name="about" />
        <Stack.Screen name="privacy-policy" />
        <Stack.Screen name="terms" />
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

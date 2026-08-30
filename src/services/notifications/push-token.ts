import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';
import { ApiResponse } from '@/types/profile';

let notificationHandlerRegistered = false;

type ExpoNotificationsModule = typeof import('expo-notifications');

function registerNotificationHandler(
  notifications: ExpoNotificationsModule,
) {
  if (notificationHandlerRegistered) {
    return;
  }

  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  notificationHandlerRegistered = true;
}

export type RegisterPushTokenResult =
  | { status: 'registered'; token: string }
  | { status: 'denied' }
  | { status: 'unsupported' };

export async function registerPushToken(): Promise<RegisterPushTokenResult> {
  if (Constants.appOwnership === 'expo') {
    return { status: 'unsupported' };
  }

  if (!Device.isDevice) {
    return { status: 'unsupported' };
  }

  const Notifications =
    await import(
      'expo-notifications'
    );

  registerNotificationHandler(
    Notifications,
  );

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existingPermissions = await Notifications.getPermissionsAsync();
  let finalStatus = existingPermissions.status;

  if (finalStatus !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    finalStatus = requested.status;
  }

  if (finalStatus !== 'granted') {
    return { status: 'denied' };
  }

  // Read the EAS project id from the app's own runtime config — never
  // hard-code it here.
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined,
  );

  const token = tokenResponse.data;

  await apiRequest<ApiResponse<{ token: string; platform: string; updatedAt: string }>>(
    '/api/notifications/register-token',
    {
      method: 'POST',
      body: JSON.stringify({
        token,
        platform: Platform.OS,
      }),
    },
  );

  return { status: 'registered', token };
}

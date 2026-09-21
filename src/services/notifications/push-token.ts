import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiRequest } from '@/services/api/client';
import {
  getRemoteNotificationsUnsupportedReason,
  loadNotificationsModule,
  type ExpoNotificationsModule,
  type RemoteNotificationsUnsupportedReason,
} from '@/services/notifications/runtime';
import { ApiResponse } from '@/types/profile';

let notificationHandlerRegistered = false;
let pushTokenRegistrationPromise: Promise<RegisterPushTokenResult> | null = null;

function registerNotificationHandler(notifications: ExpoNotificationsModule) {
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
  | {
      status: 'unsupported';
      reason: RemoteNotificationsUnsupportedReason;
    };

async function registerPushTokenOnce(): Promise<RegisterPushTokenResult> {
  const unsupportedReason = getRemoteNotificationsUnsupportedReason();

  if (unsupportedReason) {
    return { status: 'unsupported', reason: unsupportedReason };
  }

  const Notifications = await loadNotificationsModule();

  if (!Notifications) {
    // The runtime was checked above; this is only a defensive fallback.
    return { status: 'unsupported', reason: 'web' };
  }

  registerNotificationHandler(Notifications);

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
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error(
      'Push notifications are not configured: missing EAS projectId. Run `eas init` and rebuild the app.',
    );
  }

  const tokenResponse = await Notifications.getExpoPushTokenAsync({ projectId });

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

export async function registerPushToken(): Promise<RegisterPushTokenResult> {
  if (pushTokenRegistrationPromise) {
    return pushTokenRegistrationPromise;
  }

  const registrationPromise = registerPushTokenOnce();
  pushTokenRegistrationPromise = registrationPromise;

  try {
    return await registrationPromise;
  } finally {
    if (pushTokenRegistrationPromise === registrationPromise) {
      pushTokenRegistrationPromise = null;
    }
  }
}

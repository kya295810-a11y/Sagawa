import AsyncStorage from '@react-native-async-storage/async-storage';
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

const NOTIFICATION_PREFERENCE_KEY = 'notifications.enabled';

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

async function registerPushTokenOnce(force = false): Promise<RegisterPushTokenResult> {
  if (!force && (await AsyncStorage.getItem(NOTIFICATION_PREFERENCE_KEY)) === '0') {
    return { status: 'denied' };
  }
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

export async function registerPushToken(force = false): Promise<RegisterPushTokenResult> {
  if (pushTokenRegistrationPromise) {
    return pushTokenRegistrationPromise;
  }

  const registrationPromise = registerPushTokenOnce(force);
  pushTokenRegistrationPromise = registrationPromise;

  try {
    return await registrationPromise;
  } finally {
    if (pushTokenRegistrationPromise === registrationPromise) {
      pushTokenRegistrationPromise = null;
    }
  }
}


export async function getNotificationPreference() {
  return (await AsyncStorage.getItem(NOTIFICATION_PREFERENCE_KEY)) !== '0';
}

export async function enablePushNotifications() {
  const result = await registerPushToken(true);
  if (result.status === 'registered') {
    await AsyncStorage.setItem(NOTIFICATION_PREFERENCE_KEY, '1');
  }
  return result;
}

export async function disablePushNotifications() {
  await AsyncStorage.setItem(NOTIFICATION_PREFERENCE_KEY, '0');

  const unsupportedReason = getRemoteNotificationsUnsupportedReason();
  if (unsupportedReason) return;
  const Notifications = await loadNotificationsModule();
  if (!Notifications) return;
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await apiRequest('/api/notifications/unregister-token', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

export type ExpoNotificationsModule = typeof import('expo-notifications');
export type RemoteNotificationsUnsupportedReason = 'expo-go' | 'web';

/**
 * Importing expo-notifications on Android in Expo Go throws while the module is
 * being evaluated. Keep the import behind this runtime check so the rest of the
 * app can still be developed in Expo Go; remote notifications are exercised in
 * a development or release build.
 */
export function getRemoteNotificationsUnsupportedReason(): RemoteNotificationsUnsupportedReason | null {
  if (Platform.OS === 'web') {
    return 'web';
  }

  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    return 'expo-go';
  }

  return null;
}

export function canUseRemoteNotifications(): boolean {
  return getRemoteNotificationsUnsupportedReason() === null;
}

export async function loadNotificationsModule(): Promise<ExpoNotificationsModule | null> {
  if (!canUseRemoteNotifications()) {
    return null;
  }

  return import('expo-notifications');
}

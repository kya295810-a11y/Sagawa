import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

import { env } from '@/config/env';
import { apiRequest } from '@/services/api/client';

const LAST_UPDATE_CHECK_KEY = 'sagawa.update.lastCheckedAt.v1';
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

type UpdateResponse = {
  success: boolean;
  data?: {
    latestVersion?: string;
    minimumVersion?: string;
    androidUrl?: string;
    iosUrl?: string;
  };
};

export type AppUpdateStatus = {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  storeUrl: string;
};

function versionParts(value: string) {
  return value
    .split('.')
    .map((part) => Number.parseInt(part.replace(/\D.*$/, ''), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function isNewerVersion(latest: string, current: string) {
  const left = versionParts(latest);
  const right = versionParts(current);
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a > b) return true;
    if (a < b) return false;
  }

  return false;
}

export async function getLastUpdateCheckAt() {
  return AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
}

export async function checkForAppUpdate(force = false): Promise<AppUpdateStatus | null> {
  if (!force) {
    const lastChecked = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
    const timestamp = lastChecked ? Date.parse(lastChecked) : 0;
    if (timestamp && Date.now() - timestamp < UPDATE_CHECK_INTERVAL_MS) {
      return null;
    }
  }

  const response = await apiRequest<UpdateResponse>('/api/app-update');
  await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, new Date().toISOString());

  const latestVersion = String(response.data?.latestVersion || env.appVersion);
  const storeUrl =
    Platform.OS === 'ios'
      ? String(response.data?.iosUrl || '')
      : String(response.data?.androidUrl || '');

  return {
    available: isNewerVersion(latestVersion, env.appVersion),
    currentVersion: env.appVersion,
    latestVersion,
    storeUrl,
  };
}

export async function openAppStoreUpdate(url: string) {
  if (!/^https?:\/\//i.test(url)) {
    throw new Error('The app store link is not configured yet.');
  }
  await Linking.openURL(url);
}

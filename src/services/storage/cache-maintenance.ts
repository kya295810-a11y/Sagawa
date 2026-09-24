import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image as ExpoImage } from 'expo-image';
import { Paths } from 'expo-file-system';

const LAST_CACHE_CLEANUP_KEY = 'sagawa.cache.lastCleanupAt.v1';
const CACHE_CLEANUP_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

export type CacheInfo = {
  bytes: number;
  lastClearedAt: string | null;
};

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = index >= 2 ? 1 : 0;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export async function getCacheInfo(): Promise<CacheInfo> {
  const lastClearedAt = await AsyncStorage.getItem(LAST_CACHE_CLEANUP_KEY);
  let bytes = 0;

  try {
    bytes = Number(Paths.cache.size || 0);
  } catch {
    bytes = 0;
  }

  return { bytes, lastClearedAt };
}

export async function clearAppCache() {
  let bytesBefore = 0;

  try {
    bytesBefore = Number(Paths.cache.size || 0);
  } catch {
    bytesBefore = 0;
  }

  await Promise.allSettled([
    ExpoImage.clearMemoryCache(),
    ExpoImage.clearDiskCache(),
  ]);

  try {
    if (Paths.cache.exists) {
      for (const entry of Paths.cache.list()) {
        try {
          entry.delete();
        } catch {
          // Cache entries are disposable; continue if the OS is using one.
        }
      }
    }
  } catch {
    // The operating system can manage cache files concurrently.
  }

  const clearedAt = new Date().toISOString();
  await AsyncStorage.setItem(LAST_CACHE_CLEANUP_KEY, clearedAt);

  return {
    bytesBefore,
    clearedAt,
  };
}

export async function runScheduledCacheCleanup() {
  const now = Date.now();
  const stored = await AsyncStorage.getItem(LAST_CACHE_CLEANUP_KEY);

  if (!stored) {
    await AsyncStorage.setItem(LAST_CACHE_CLEANUP_KEY, new Date(now).toISOString());
    return { cleared: false };
  }

  const last = Date.parse(stored);
  if (!Number.isFinite(last) || now - last >= CACHE_CLEANUP_INTERVAL_MS) {
    await clearAppCache();
    return { cleared: true };
  }

  return { cleared: false };
}

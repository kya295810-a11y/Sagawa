import { env } from '@/config/env';

/**
 * Converts a relative path returned by the backend (e.g.
 * "/uploads/profile/xxxx.jpg") into an absolute URL using the app's
 * configured API base URL. Absolute URLs are returned unchanged.
 * Never hard-code a host here — always read from env.
 */
export function getMediaUrl(path?: string | null): string | undefined {
  if (!path) {
    return undefined;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!env.EXPO_PUBLIC_API_URL) {
    return undefined;
  }

  const base = env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  const relative = path.startsWith('/') ? path : `/${path}`;

  return `${base}${relative}`;
}
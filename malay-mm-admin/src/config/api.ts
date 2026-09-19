const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '';

export const API_BASE = configuredApiUrl.replace(/\/+$/, '');

if (!API_BASE) {
  console.error(
    '[Admin API] VITE_API_URL is missing. Configure it in malay-mm-admin/.env or .env.local.',
  );
}

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export function mediaUrl(path?: string) {
  if (!path) return '';
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  return apiUrl(path.startsWith('/') ? path : `/${path}`);
}

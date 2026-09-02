const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '';

export const API_BASE = configuredApiUrl.replace(/\/+$/, '');

console.log('[Admin API] Configuration:', {
  VITE_API_URL: import.meta.env.VITE_API_URL,
  API_BASE: API_BASE || '(empty)',
  isDev: import.meta.env.DEV,
});

if (!API_BASE) {
  console.error(
    '[Admin API] VITE_API_URL is missing. Configure it in malay-mm-admin/.env or .env.local.',
  );
}

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}
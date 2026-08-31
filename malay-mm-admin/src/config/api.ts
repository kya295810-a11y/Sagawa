const configuredApiUrl = import.meta.env.VITE_API_URL?.trim() || '';

export const API_BASE = configuredApiUrl.replace(/\/+$/, '');

if (!API_BASE) {
  console.error(
    '[Admin API] VITE_API_URL is missing. Configure it in malay-mm-admin/.env.local.',
  );
}

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}
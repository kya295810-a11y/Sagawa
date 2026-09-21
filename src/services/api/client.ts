import { fetch } from 'expo/fetch';

import { env } from '@/config/env';
import { ApiError, NetworkError } from '@/services/api/errors';

type ApiRequestOptions = Omit<RequestInit, 'body' | 'headers' | 'signal'> & {
  body?: BodyInit | null;
  headers?: HeadersInit;
  signal?: AbortSignal;
};

type TokenProvider = () => Promise<string | null>;
type UnauthorizedHandler = () => Promise<void> | void;

let getAccessToken: TokenProvider = async () => null;
let handleUnauthorized: UnauthorizedHandler = () => undefined;

export function registerAccessTokenProvider(provider: TokenProvider) {
  getAccessToken = provider;
}

export function registerUnauthorizedHandler(handler: UnauthorizedHandler) {
  handleUnauthorized = handler;
}

function buildApiUrl(path: string) {
  const baseUrl = (env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  return `${baseUrl}${normalizedPath}`;
}

export function apiAssetUrl(path?: string | null) {
  if (!path) return '';
  if (/^(?:https?:|data:)/i.test(path)) return path;
  return buildApiUrl(path);
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  if (!env.EXPO_PUBLIC_API_URL) {
    throw new ApiError('Missing public API base URL configuration.', {
      code: 'missing_api_url',
      status: 500,
    });
  }

  const controller = new AbortController();
  const callerSignal = options.signal;
  let timedOut = false;

  const forwardCallerAbort = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal?.aborted) {
    forwardCallerAbort();
  } else {
    callerSignal?.addEventListener('abort', forwardCallerAbort, { once: true });
  }

  const timeoutId = setTimeout(() => {
    if (controller.signal.aborted) {
      return;
    }

    timedOut = true;
    controller.abort();
  }, env.EXPO_PUBLIC_API_TIMEOUT_MS);

  try {
    const accessToken = await getAccessToken();
    const headers = new Headers(options.headers);
    headers.set('Accept', 'application/json');

    // Do not force a Content-Type when the body is FormData (e.g. multipart
    // image uploads). expo/fetch must set its own
    // "multipart/form-data; boundary=..." header — overriding it here would
    // break the upload.
    const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

    if (!headers.has('Content-Type') && options.body && !isFormData) {
      headers.set('Content-Type', 'application/json');
    }

    if (accessToken) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    const response = await fetch(buildApiUrl(path), {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      let details: unknown = null;
      const responseBody = await response.text();

      try {
        details = responseBody ? JSON.parse(responseBody) : null;
      } catch {
        details = responseBody;
      }

      const serverMessage =
        details &&
        typeof details === 'object' &&
        'message' in details &&
        typeof details.message === 'string'
          ? details.message
          : `Request failed (${response.status}).`;

      if (response.status === 401 && accessToken) {
        await handleUnauthorized();
      }

      throw new ApiError(serverMessage, {
        code: 'api_request_failed',
        details,
        status: response.status,
      });
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (callerSignal?.aborted && !timedOut) {
      throw error;
    }

    if (timedOut) {
      throw new ApiError('API request timed out.', {
        code: 'request_timeout',
        status: 408,
      });
    }

    throw new NetworkError('Unable to reach Sagawa. Check your connection and try again.', error);
  } finally {
    clearTimeout(timeoutId);
    callerSignal?.removeEventListener('abort', forwardCallerAbort);
  }
}

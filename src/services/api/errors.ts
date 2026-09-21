export class ApiError extends Error {
  code: string;
  details?: unknown;
  status: number;

  constructor(message: string, options?: { code?: string; details?: unknown; status?: number }) {
    super(message);
    this.name = 'ApiError';
    this.code = options?.code ?? 'api_error';
    this.details = options?.details;
    this.status = options?.status ?? 500;
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network unavailable', details?: unknown) {
    super(message, { code: 'network_unavailable', details, status: 0 });
    this.name = 'NetworkError';
  }
}

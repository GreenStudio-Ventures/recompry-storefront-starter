// Manejo del envelope de error del API: `{ ok:false, code, error, details?, request_id }`.
// `code` es estable (para lógica), `error` es el mensaje humano en español (para la UI).
import type { ErrorResponse } from './types';

export class RecompryApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(status: number, body: Partial<ErrorResponse> | null | undefined, fallback?: string) {
    super(body?.error ?? fallback ?? `Error ${status} del API de Recompry`);
    this.name = 'RecompryApiError';
    this.status = status;
    this.code = body?.code ?? (status === 0 ? 'network_error' : `http_${status}`);
    this.details = body?.details;
    this.requestId = body?.request_id ?? null;
  }

  /** Envelope listo para reenviar desde un route handler (mismo contrato que el API). */
  toEnvelope(): ErrorResponse {
    return {
      ok: false,
      code: this.code,
      error: this.message,
      details: this.details,
      request_id: this.requestId ?? 'local',
    };
  }
}

type FetchResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/**
 * Convierte el `{ data, error, response }` de openapi-fetch en `data` o lanza `RecompryApiError`.
 * Úsalo en server components y route handlers: `const store = unwrap(await api.GET('/v1/store')).data`.
 */
export function unwrap<T>(result: FetchResult<T>): T {
  if (result.error !== undefined || result.data === undefined) {
    const body = (result.error ?? null) as Partial<ErrorResponse> | null;
    throw new RecompryApiError(result.response?.status ?? 0, body);
  }
  return result.data;
}

export function isApiError(err: unknown): err is RecompryApiError {
  return err instanceof RecompryApiError;
}

/** Normaliza cualquier error (API, red, bug) a un envelope + status HTTP para responder desde route handlers. */
export function toErrorResponse(err: unknown): { status: number; body: ErrorResponse } {
  if (isApiError(err)) return { status: err.status || 502, body: err.toEnvelope() };
  const message = err instanceof Error ? err.message : 'Error inesperado';
  return {
    status: 500,
    body: { ok: false, code: 'internal_error', error: message, request_id: 'local' },
  };
}

// Fetch tipado desde el browser hacia los route handlers de /api/* (mismo envelope del API).
import type { ErrorResponse } from '@/lib/recompry/types';

export class ClientApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId: string | null;

  constructor(status: number, body: Partial<ErrorResponse> | null) {
    super(body?.error ?? (status === 0 ? 'No hay conexión.' : `Error ${status}`));
    this.name = 'ClientApiError';
    this.status = status;
    this.code = body?.code ?? (status === 0 ? 'network_error' : `http_${status}`);
    this.details = body?.details;
    this.requestId = body?.request_id ?? null;
  }
}

export type UiError = { message: string; code?: string; requestId?: string | null; details?: unknown };

export function toUiError(err: unknown): UiError {
  if (err instanceof ClientApiError) return { message: err.message, code: err.code, requestId: err.requestId, details: err.details };
  if (err instanceof Error) return { message: err.message };
  return { message: 'Ocurrió un error inesperado.' };
}

export async function callApi<T>(
  path: string,
  init: { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body !== undefined ? 'POST' : 'GET'),
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: init.signal,
      credentials: 'same-origin',
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new ClientApiError(0, null);
  }
  const json = (await res.json().catch(() => null)) as { data?: T; ok?: boolean } | null;
  if (!res.ok || !json || json.ok === false) throw new ClientApiError(res.status, (json ?? null) as Partial<ErrorResponse> | null);
  return json.data as T;
}

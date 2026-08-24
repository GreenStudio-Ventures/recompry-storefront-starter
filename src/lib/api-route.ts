// Utilidades para los route handlers de /api/*: mismo envelope que el API de Recompry
// (`{ data }` en éxito, `{ ok:false, code, error, request_id }` en error) para que el
// browser maneje una sola forma de respuesta.
import 'server-only';
import { NextResponse } from 'next/server';
import { RecompryApiError, toErrorResponse } from '@/lib/recompry/errors';
import { getBuyerSession, writeBuyerSession } from '@/lib/recompry/session';
import type { BuyerSession } from '@/lib/recompry/types';

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new RecompryApiError(400, { code: 'invalid_json', error: 'El body debe ser JSON válido.' });
  }
}

export function badRequest(code: string, error: string, details?: unknown): never {
  throw new RecompryApiError(400, { code, error, details });
}

/** Ejecuta el handler y convierte cualquier error en el envelope de error con su status. */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    if (status >= 500) console.error('[api]', err);
    return NextResponse.json(body, { status });
  }
}

/** Sesión del comprador (renovada y persistida si hacía falta) o null si no hay login. */
export async function optionalBuyer(): Promise<BuyerSession | null> {
  const { session, refreshed } = await getBuyerSession();
  if (session && refreshed) await writeBuyerSession(session);
  return session;
}

/** Igual que `optionalBuyer` pero responde 401 `buyer_token_required` si no hay sesión. */
export async function requireBuyer(): Promise<BuyerSession> {
  const session = await optionalBuyer();
  if (!session) {
    throw new RecompryApiError(401, { code: 'buyer_token_required', error: 'Inicia sesión para continuar.' });
  }
  return session;
}

// Utilidades para los route handlers de /api/*: mismo envelope que el API de Recompry
// (`{ data }` en éxito, `{ ok:false, code, error, request_id }` en error) para que el
// browser maneje una sola forma de respuesta.
import 'server-only';
import { NextResponse } from 'next/server';
import { isGuestOrder, isOrderUuid } from '@/lib/guest-orders';
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
    // El detalle solo vive aquí (al browser va un mensaje genérico); el request_id los enlaza.
    if (status >= 500) console.error('[api]', body.request_id, err);
    return NextResponse.json(body, { status });
  }
}

/**
 * Sesión del comprador (renovada y persistida si hacía falta) o null si no hay login.
 * Aquí sí se renueva (`refresh: true`): un route handler puede reescribir la cookie, y el
 * refresh rota el token, así que renovar sin persistir lo perdería. Las páginas NO renuevan.
 */
export async function optionalBuyer(): Promise<BuyerSession | null> {
  const { session, refreshed } = await getBuyerSession({ refresh: true });
  if (session && refreshed) await writeBuyerSession(session);
  return session;
}

/**
 * Guarda de acceso a UNA orden desde el browser (`/api/orders/[id]/payment(s)`).
 *
 * El API resuelve `order_id` como uuid O `order_number`, y su doc avisa: "sin X-Buyer-Token
 * la key secreta puede consultar cualquier orden de la tienda por order_number". Por eso:
 * 1. solo aceptamos uuid (el consecutivo es enumerable);
 * 2. sin sesión, solo ids que este navegador creó (cookie de `rememberGuestOrder`);
 * 3. con sesión, devolvemos el buyer para que el handler pase `X-Buyer-Token` y el API
 *    valide la propiedad.
 * Cualquier rechazo es 404 `order_not_found`: un 403 confirmaría que la orden existe.
 */
export async function orderAccess(id: string): Promise<BuyerSession | null> {
  const notFound = () => new RecompryApiError(404, { code: 'order_not_found', error: 'No encontramos esa orden.' });
  if (!isOrderUuid(id)) throw notFound();
  const buyer = await optionalBuyer();
  if (buyer) return buyer;
  if (!(await isGuestOrder(id))) throw notFound();
  return null;
}

/** Igual que `optionalBuyer` pero responde 401 `buyer_token_required` si no hay sesión. */
export async function requireBuyer(): Promise<BuyerSession> {
  const session = await optionalBuyer();
  if (!session) {
    throw new RecompryApiError(401, { code: 'buyer_token_required', error: 'Inicia sesión para continuar.' });
  }
  return session;
}

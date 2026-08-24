// Órdenes creadas SIN sesión, ligadas al navegador que las creó.
//
// El API acepta `id` (uuid) u `order_number` en `/v1/orders/{order_id}/payment(s)` y, según su
// propia doc, "sin X-Buyer-Token la key secreta puede consultar cualquier orden de la tienda
// por order_number". Como el checkout invitado no tiene buyer token, sin esta cookie cualquier
// visitante podría sondear (y anular, con una tarjeta rechazada) las órdenes de otros clientes
// enumerando el consecutivo. Guardamos los ids en una cookie httpOnly y solo dejamos pasar
// esos ids cuando no hay sesión; con sesión el API valida la propiedad vía `X-Buyer-Token`.
import { cookies } from 'next/headers';

export const GUEST_ORDERS_COOKIE = 'rcp_guest_orders';
export const GUEST_ORDERS_MAX = 10;
const GUEST_ORDERS_MAX_AGE = 60 * 60 * 24 * 7;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Solo aceptamos el uuid de la orden: el consecutivo (`order_number`) es enumerable. */
export function isOrderUuid(id: string | null | undefined): id is string {
  return typeof id === 'string' && UUID_RE.test(id);
}

export function guestOrdersCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: GUEST_ORDERS_MAX_AGE,
  };
}

/** Lista separada por comas → ids válidos (ignora basura: la cookie la puede editar el usuario). */
export function parseGuestOrderIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const id = part.trim().toLowerCase();
    if (isOrderUuid(id) && !out.includes(id)) out.push(id);
  }
  return out.slice(-GUEST_ORDERS_MAX);
}

/** Añade `id` al final (el más reciente) y recorta a `GUEST_ORDERS_MAX` para que la cookie no crezca sin límite. */
export function appendGuestOrderId(existing: string[], id: string): string[] {
  const clean = id.toLowerCase();
  const next = existing.filter((x) => x !== clean);
  next.push(clean);
  return next.slice(-GUEST_ORDERS_MAX);
}

export function serializeGuestOrderIds(ids: string[]): string {
  return ids.join(',');
}

/** Ids de órdenes invitadas que este navegador creó (puede estar vacío). */
export async function readGuestOrderIds(): Promise<string[]> {
  const jar = await cookies();
  return parseGuestOrderIds(jar.get(GUEST_ORDERS_COOKIE)?.value);
}

/** Solo en route handlers (los server components no pueden escribir cookies). */
export async function rememberGuestOrder(orderId: string): Promise<void> {
  if (!isOrderUuid(orderId)) return;
  const jar = await cookies();
  const ids = appendGuestOrderId(parseGuestOrderIds(jar.get(GUEST_ORDERS_COOKIE)?.value), orderId);
  jar.set(GUEST_ORDERS_COOKIE, serializeGuestOrderIds(ids), guestOrdersCookieOptions());
}

/** ¿Este navegador creó la orden `orderId` como invitado? */
export async function isGuestOrder(orderId: string): Promise<boolean> {
  if (!isOrderUuid(orderId)) return false;
  return (await readGuestOrderIds()).includes(orderId.toLowerCase());
}

// Sesión del comprador (OTP → access_token/refresh_token) guardada en una cookie httpOnly.
// El API no guarda sesiones: el template es el dueño del token y lo pasa en `X-Buyer-Token`.
import 'server-only';
import { cookies } from 'next/headers';
import type { BuyerSession } from './types';
import { serverApi } from './server';

export const BUYER_COOKIE = 'rcp_buyer';
const REFRESH_SKEW_SECONDS = 60;

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // El refresh_token vive días; la cookie dura 30 días y se reescribe en cada renovación.
    maxAge: 60 * 60 * 24 * 30,
  };
}

export function serializeSession(session: BuyerSession): string {
  return JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user,
  });
}

export function parseSession(raw: string | undefined): BuyerSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BuyerSession>;
    if (!parsed.access_token || !parsed.refresh_token || !parsed.expires_at || !parsed.user) return null;
    return parsed as BuyerSession;
  } catch {
    return null;
  }
}

/** Sesión tal cual está en la cookie (puede estar vencida). */
export async function readBuyerSession(): Promise<BuyerSession | null> {
  const jar = await cookies();
  return parseSession(jar.get(BUYER_COOKIE)?.value);
}

export function isExpired(session: BuyerSession, skewSeconds = REFRESH_SKEW_SECONDS): boolean {
  return session.expires_at - skewSeconds <= Math.floor(Date.now() / 1000);
}

export type BuyerSessionState = {
  /** Sesión VIGENTE (nunca vencida) o null. */
  session: BuyerSession | null;
  /** true si `session` salió de `/v1/auth/refresh` y todavía no está en la cookie: hay que persistirla. */
  refreshed: boolean;
  /** true si hay cookie pero el access_token venció (o vence en <60 s) y NO se renovó (`refresh: false`). */
  expired: boolean;
};

/**
 * Sesión vigente para usar en `X-Buyer-Token`.
 *
 * - `{ refresh: true }` (default; SOLO route handlers): si el access_token está por vencer lo
 *   renueva con `POST /v1/auth/refresh` y devuelve `refreshed: true` para que el caller lo
 *   persista con `writeBuyerSession()`.
 * - `{ refresh: false }` (server components / páginas): nunca llama al API. El refresh ROTA el
 *   token ("el anterior deja de servir") y una página no puede reescribir la cookie, así que
 *   renovar desde ahí consume el refresh_token y deja al comprador sin sesión (o crea su
 *   pedido como invitado). La página recibe `expired: true` y decide: renderizar
 *   `<SessionRefresher/>` (que sí pasa por un handler) o mandar al login.
 */
export async function getBuyerSession(opts: { refresh?: boolean } = {}): Promise<BuyerSessionState> {
  const refresh = opts.refresh ?? true;
  const current = await readBuyerSession();
  if (!current) return { session: null, refreshed: false, expired: false };
  if (!isExpired(current)) return { session: current, refreshed: false, expired: false };
  if (!refresh) return { session: null, refreshed: false, expired: true };
  try {
    const { data } = await serverApi().POST('/v1/auth/refresh', {
      body: { refresh_token: current.refresh_token },
    });
    if (data?.data) return { session: data.data, refreshed: true, expired: false };
  } catch {
    // red caída: tratamos la sesión como inválida
  }
  return { session: null, refreshed: false, expired: false };
}

export async function writeBuyerSession(session: BuyerSession): Promise<void> {
  const jar = await cookies();
  jar.set(BUYER_COOKIE, serializeSession(session), sessionCookieOptions());
}

export async function clearBuyerSession(): Promise<void> {
  const jar = await cookies();
  jar.set(BUYER_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
}

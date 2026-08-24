import { handle, ok } from '@/lib/api-route';
import { getBuyerSession, writeBuyerSession, clearBuyerSession } from '@/lib/recompry/session';

// Renueva el access_token con el refresh_token (los server components no pueden reescribir
// cookies, así que <SessionRefresher/> llama aquí cuando detecta la sesión vencida).
export async function POST() {
  return handle(async () => {
    const { session, refreshed } = await getBuyerSession();
    if (!session) {
      await clearBuyerSession();
      return ok({ authenticated: false });
    }
    if (refreshed) await writeBuyerSession(session);
    return ok({ authenticated: true, expires_at: session.expires_at, user: session.user });
  });
}

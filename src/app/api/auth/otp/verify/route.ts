import { handle, ok, readJson, badRequest } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { serverApi } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';
import { writeBuyerSession } from '@/lib/recompry/session';

// Paso 2: canjea el código por una sesión y la guarda en cookie httpOnly.
export async function POST(req: Request) {
  return handle(async () => {
    const { email, token } = await readJson<{ email?: string; token?: string }>(req);
    const cleanEmail = (email ?? '').trim().toLowerCase();
    const cleanToken = (token ?? '').replace(/\s+/g, '');
    if (!cleanEmail) badRequest('email_required', 'Falta el correo.');
    if (cleanToken.length < 4) badRequest('token_required', 'Escribe el código que recibiste.');

    const { data: session } = unwrap(
      await publicApi().POST('/v1/auth/otp/verify', { body: { channel: 'email', email: cleanEmail, token: cleanToken } }),
    );
    await writeBuyerSession(session);

    // Best-effort: crea/enlaza la ficha del comprador en esta tienda (scope customers:write).
    // Con keys de test no escribe nada y /v1/customers/me puede responder 404 customer_not_found.
    try {
      await serverApi(session.access_token).POST('/v1/customers/ensure', { body: {} });
    } catch (err) {
      console.warn('[auth] customers/ensure omitido:', err instanceof Error ? err.message : err);
    }

    return ok({ user: session.user, expires_at: session.expires_at });
  });
}

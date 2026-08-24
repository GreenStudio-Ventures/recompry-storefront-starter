import { handle, ok, readJson, badRequest } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';

// Paso 1 del login sin contraseña: el API envía un código al correo del comprador.
export async function POST(req: Request) {
  return handle(async () => {
    const { email } = await readJson<{ email?: string }>(req);
    const clean = (email ?? '').trim().toLowerCase();
    if (!clean || !clean.includes('@')) badRequest('email_required', 'Escribe un correo válido.');
    const result = unwrap(await publicApi().POST('/v1/auth/otp/send', { body: { channel: 'email', email: clean } }));
    return ok(result.data);
  });
}

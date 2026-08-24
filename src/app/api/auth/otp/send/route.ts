import { NextResponse } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import { handle, ok, readJson, badRequest } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';
import { OTP_RATE_LIMIT_PERIOD_SECONDS, checkOtpLimits, clientIp, isValidEmail, normalizeEmail, type OtpLimiterEnv } from '@/lib/otp-guard';

// Bindings del Worker; fuera de Workers (`next dev` sin initOpenNextCloudflareForDev, tests)
// no hay contexto y el guard cae a fail-open con aviso.
async function limiterEnv(): Promise<OtpLimiterEnv | null> {
  try {
    return (await getCloudflareContext({ async: true })).env;
  } catch {
    return null;
  }
}

// Paso 1 del login sin contraseña: el API envía un código al correo del comprador.
// Este relay sale con la publishable key de la tienda, así que limita por correo e IP antes
// de reenviar: sin eso es un cañón de spam OTP y consume el bucket pk compartido con el SSR.
export async function POST(req: Request) {
  return handle(async () => {
    const { email } = await readJson<{ email?: string }>(req);
    const clean = normalizeEmail(email);
    if (!isValidEmail(clean)) badRequest('invalid_email', 'Escribe un correo válido.');
    const verdict = await checkOtpLimits(await limiterEnv(), { email: clean, ip: clientIp(req.headers) });
    if (!verdict.allowed) {
      return NextResponse.json(
        { ok: false, code: 'rate_limited', error: 'Demasiados intentos. Espera un minuto.', request_id: 'local' },
        { status: 429, headers: { 'Retry-After': String(OTP_RATE_LIMIT_PERIOD_SECONDS) } },
      );
    }
    const result = unwrap(await publicApi().POST('/v1/auth/otp/send', { body: { channel: 'email', email: clean } }));
    return ok(result.data);
  });
}

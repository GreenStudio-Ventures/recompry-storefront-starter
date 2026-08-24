// Guardas del relay OTP (/api/auth/otp/send). Sin ellas cualquier visitante usa la tienda para
// bombardear con códigos a correos arbitrarios (el API además crea la cuenta) y un flood a esta
// ruta agota el bucket pk del API que comparte con el render del storefront (la tienda entera
// cae a SetupScreen). Funciones puras con bindings inyectables para testearlas sin Workers.

/** Forma mínima del binding nativo de Workers Rate Limiting (`ratelimits` en wrangler.jsonc). */
export interface RateLimiterBinding {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

/** Bindings que declara wrangler.jsonc; opcionales porque en `next dev`/tests no existen. */
export interface OtpLimiterEnv {
  OTP_RATE_LIMITER_EMAIL?: RateLimiterBinding;
  OTP_RATE_LIMITER_IP?: RateLimiterBinding;
}

export type OtpLimitScope = 'email' | 'ip';
export type OtpLimitResult = { allowed: true } | { allowed: false; scope: OtpLimitScope };

/** Debe coincidir con `simple.period` de wrangler.jsonc (el binding solo admite 10 o 60). */
export const OTP_RATE_LIMIT_PERIOD_SECONDS = 60;
export const EMAIL_MAX_LENGTH = 200;

// Deliberadamente laxa (el API/Supabase validan de verdad); solo descarta basura obvia
// (espacios, sin dominio, sin TLD) antes de gastar un envío de correo.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Misma normalización que usa la clave del rate limit: dos escrituras del mismo correo cuentan juntas. */
export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function isValidEmail(email: string): boolean {
  return email.length > 0 && email.length <= EMAIL_MAX_LENGTH && EMAIL_RE.test(email);
}

/**
 * IP del visitante. `cf-connecting-ip` la pone Cloudflare y no es falsificable desde fuera;
 * `x-forwarded-for` (primer valor) cubre `next dev`/proxies. Sin ninguna, todos comparten
 * el bucket 'unknown' (mejor un límite común que ninguno).
 */
export function clientIp(headers: Headers): string {
  const cf = headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || 'unknown';
}

let warnedMissingBinding = false;

/** Solo para tests: vuelve a permitir el aviso de binding ausente. */
export function resetOtpGuardWarnings(): void {
  warnedMissingBinding = false;
}

function warnMissingBindingOnce(): void {
  if (warnedMissingBinding) return;
  warnedMissingBinding = true;
  console.warn(
    '[otp-guard] Sin bindings OTP_RATE_LIMITER_* (next dev o tests): /api/auth/otp/send corre SIN rate limit. ' +
      'En producción se despliegan desde "ratelimits" en wrangler.jsonc.',
  );
}

/**
 * Consume un intento en el bucket por IP y en el bucket por correo. Fail-open si falta algún
 * binding (con un solo aviso): bloquear el login por una config incompleta sería peor que
 * dejar pasar spam en desarrollo.
 */
export async function checkOtpLimits(
  env: OtpLimiterEnv | null | undefined,
  ids: { email: string; ip: string },
): Promise<OtpLimitResult> {
  const checks: Array<[OtpLimitScope, RateLimiterBinding | undefined, string]> = [
    ['ip', env?.OTP_RATE_LIMITER_IP, `ip:${ids.ip}`],
    ['email', env?.OTP_RATE_LIMITER_EMAIL, `email:${normalizeEmail(ids.email)}`],
  ];
  for (const [scope, limiter, key] of checks) {
    if (!limiter) {
      warnMissingBindingOnce();
      continue;
    }
    const { success } = await limiter.limit({ key });
    if (!success) return { allowed: false, scope };
  }
  return { allowed: true };
}

// Tipado de los bindings propios del Worker. `env.d.ts` (generado con `npm run types`) está
// gitignored, así que sin esto `getCloudflareContext().env` no conoce los limitadores y el
// handler OTP no compila en un clon limpio. Mantener en sync con "ratelimits" de wrangler.jsonc.
import type { RateLimiterBinding } from './otp-guard';

declare global {
  interface CloudflareEnv {
    OTP_RATE_LIMITER_EMAIL?: RateLimiterBinding;
    OTP_RATE_LIMITER_IP?: RateLimiterBinding;
  }
}

export {};

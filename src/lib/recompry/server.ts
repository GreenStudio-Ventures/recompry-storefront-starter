// Cliente con la key SECRETA (rcp_sk_*). SOLO importable desde código de servidor
// (`server-only` rompe el build si un client component lo importa por error).
// Úsalo en route handlers para órdenes, pagos, cuenta del comprador, suscripciones, etc.
import 'server-only';
import { createRecompryClient, type RecompryClient } from './index';
import { RECOMPRY_API_URL } from './client';
import { RecompryApiError } from './errors';

export function serverApi(buyerToken?: string | null): RecompryClient {
  const apiKey = process.env.RECOMPRY_SECRET_KEY;
  if (!apiKey) {
    // RecompryApiError (no Error pelado) para que `handle()` lo devuelva como 503 legible en vez
    // de un 500 opaco: navegar la tienda demo NO necesita esta key, solo vender.
    throw new RecompryApiError(503, {
      code: 'secret_key_missing',
      error:
        'Falta RECOMPRY_SECRET_KEY: esta acción escribe en la tienda. Emite una key rcp_sk_* en ' +
        'app.recompry.com → Configuración → API keys (preset «Tienda headless (starter)») y ponla en .env.local. ' +
        'El catálogo y el carrito funcionan sin ella.',
    });
  }
  return createRecompryClient({ apiKey, baseUrl: RECOMPRY_API_URL, buyerToken: buyerToken ?? undefined });
}

/** Genera un `Idempotency-Key` cuando el cliente no envió uno (cada intento de compra debe tener el suyo). */
export function idempotencyKey(fromClient?: string | null): string {
  const clean = (fromClient ?? '').trim();
  if (clean.length >= 8 && clean.length <= 200) return clean;
  return crypto.randomUUID();
}

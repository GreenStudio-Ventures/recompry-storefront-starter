// Verificación de webhooks salientes de Recompry.
//
// Header: `X-Recompry-Signature: t=<unix>,v1=<hex hmac_sha256(secret, `${t}.${rawBody}`)>`
// Se verifica sobre el BODY CRUDO (no re-serialices el JSON) y se rechaza `t` con más de
// 5 minutos de diferencia. Implementado con WebCrypto para correr igual en Node, Workers y tests.

export const SIGNATURE_HEADER = 'x-recompry-signature';
export const DEFAULT_TOLERANCE_SECONDS = 300;

export type RecompryWebhookEvent<T = unknown> = {
  event_id: string;
  event: string;
  occurred_at: string;
  organization: { id: string; slug: string };
  data: T;
  api_version: 'v1';
};

export type VerifyOptions = {
  toleranceSeconds?: number;
  /** Segundos Unix "ahora" (inyectable en tests). */
  now?: number;
};

export type VerifyResult =
  | { ok: true; timestamp: number }
  | { ok: false; reason: 'missing_header' | 'malformed_header' | 'timestamp_out_of_tolerance' | 'signature_mismatch' };

export function parseSignatureHeader(header: string | null | undefined): { t: number; v1: string[] } | null {
  if (!header) return null;
  let t: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key === 't') {
      const n = Number(value);
      if (Number.isFinite(n)) t = n;
    } else if (key === 'v1' && /^[0-9a-f]{64}$/i.test(value)) {
      v1.push(value.toLowerCase());
    }
  }
  if (t === null || v1.length === 0) return null;
  return { t, v1 };
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Comparación en tiempo constante sobre strings hex de igual longitud. */
function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Firma un body (útil para tests y para el script `npm run webhook:test`). */
export async function signWebhookPayload(secret: string, rawBody: string, timestamp: number): Promise<string> {
  const v1 = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
  return `t=${timestamp},v1=${v1}`;
}

export async function verifyWebhookSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  options: VerifyOptions = {},
): Promise<VerifyResult> {
  if (!header) return { ok: false, reason: 'missing_header' };
  const parsed = parseSignatureHeader(header);
  if (!parsed) return { ok: false, reason: 'malformed_header' };

  const now = options.now ?? Math.floor(Date.now() / 1000);
  const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  if (Math.abs(now - parsed.t) > tolerance) return { ok: false, reason: 'timestamp_out_of_tolerance' };

  const expected = await hmacSha256Hex(secret, `${parsed.t}.${rawBody}`);
  // Se aceptan varias v1 (rotación de secreto): basta con que una coincida.
  const match = parsed.v1.some((candidate) => timingSafeEqualHex(candidate, expected));
  if (!match) return { ok: false, reason: 'signature_mismatch' };
  return { ok: true, timestamp: parsed.t };
}

/**
 * Dedupe por `event_id` en memoria (los reintentos del API pueden entregar el mismo evento
 * más de una vez). En Cloudflare Workers la memoria es por isolate y efímera: para producción
 * persiste los ids vistos en KV/D1/tu base de datos.
 */
export class InMemoryEventDedupe {
  private readonly seen = new Map<string, number>();
  constructor(private readonly maxEntries = 1000) {}

  /** true si el evento es nuevo (y lo registra); false si ya se había procesado. */
  markIfNew(eventId: string): boolean {
    if (this.seen.has(eventId)) return false;
    this.seen.set(eventId, Date.now());
    if (this.seen.size > this.maxEntries) {
      const oldest = this.seen.keys().next().value;
      if (oldest !== undefined) this.seen.delete(oldest);
    }
    return true;
  }
}

// Verificación de webhooks salientes de Recompry.
//
// Header: `X-Recompry-Signature: t=<unix>,v1=<hex hmac_sha256(secret, `${t}.${rawBody}`)>`
// Se verifica sobre el BODY CRUDO (no re-serialices el JSON) y se rechaza `t` con más de
// 5 minutos de diferencia. Implementado con WebCrypto para correr igual en Node, Workers y tests.
//
// Recompry firma con este mismo header DOS mecanismos con payloads distintos:
// - webhook_endpoints del API público (`POST /v1/webhook-endpoints`): envelope v1 con `event_id`.
// - Automatizaciones del dashboard (Configuración → Automatizaciones → acción "webhook"):
//   `{ event, order, organization, sent_at }` SIN `event_id`. `normalizeWebhookEvent` acepta ambos.

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

/**
 * Payload de las Automatizaciones del dashboard (shape de cf-re-app `OrderEventPayload`).
 * No es el envelope v1: no hay `event_id`, `data` ni `api_version`; la orden viene resumida.
 */
export type RecompryAutomationPayload = {
  event: 'order.created' | 'order.paid' | 'order.stage_changed' | (string & {});
  order: {
    id: string;
    tracking_code: string | null;
    order_number: number | string | null;
    stage_from: string | null;
    stage_to: string | null;
    order_type: string | null;
    order_origin: string | null;
    source: string | null;
    total: number;
    currency: string | null;
    customer: { name: string | null; phone: string | null };
  };
  organization: { id: string; slug: string | null; name: string | null };
  sent_at: string;
};

export type NormalizedWebhookEvent =
  | {
      source: 'endpoint';
      event: string;
      /** `event_id` del envelope. */
      dedupeKey: string;
      occurredAt: string | null;
      organizationSlug: string | null;
      payload: RecompryWebhookEvent;
    }
  | {
      source: 'automation';
      event: string;
      /** Derivada: `event:order.id:stage_from:stage_to` (no hay `event_id`). */
      dedupeKey: string;
      occurredAt: string | null;
      organizationSlug: string | null;
      payload: RecompryAutomationPayload;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reconoce el body ya verificado (envelope v1 o Automatización) y devuelve una vista común con
 * la clave de dedupe. `null` = ninguno de los dos shapes (responde 400). Nunca exige `event_id`:
 * las Automatizaciones no lo traen y rechazarlas marcaría la regla como fallida en el dashboard.
 */
export function normalizeWebhookEvent(raw: unknown): NormalizedWebhookEvent | null {
  if (!isRecord(raw) || typeof raw.event !== 'string' || !raw.event) return null;
  const organization = isRecord(raw.organization) ? raw.organization : null;
  const organizationSlug = typeof organization?.slug === 'string' ? organization.slug : null;

  if (typeof raw.event_id === 'string' && raw.event_id) {
    const payload = raw as unknown as RecompryWebhookEvent;
    return {
      source: 'endpoint',
      event: payload.event,
      dedupeKey: payload.event_id,
      occurredAt: typeof raw.occurred_at === 'string' ? raw.occurred_at : null,
      organizationSlug,
      payload,
    };
  }

  const order = isRecord(raw.order) ? raw.order : null;
  if (order && typeof order.id === 'string' && order.id) {
    const payload = raw as unknown as RecompryAutomationPayload;
    // Un reintento de la misma transición repite exactamente estos valores (es la misma clave de
    // idempotencia que usa el dashboard); una transición nueva de la misma orden no colisiona.
    const stageFrom = typeof order.stage_from === 'string' ? order.stage_from : '';
    const stageTo = typeof order.stage_to === 'string' ? order.stage_to : '';
    return {
      source: 'automation',
      event: payload.event,
      dedupeKey: `${payload.event}:${order.id}:${stageFrom}:${stageTo}`,
      occurredAt: typeof raw.sent_at === 'string' ? raw.sent_at : null,
      organizationSlug,
      payload,
    };
  }
  return null;
}

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
 * Dedupe por clave de evento en memoria (los reintentos del API pueden entregar el mismo evento
 * más de una vez; la clave sale de `normalizeWebhookEvent`). En Cloudflare Workers la memoria es por isolate y efímera: para producción
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

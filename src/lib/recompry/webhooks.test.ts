import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import {
  InMemoryEventDedupe,
  normalizeWebhookEvent,
  parseSignatureHeader,
  signWebhookPayload,
  verifyWebhookSignature,
} from './webhooks';

const SECRET = 'whsec_test_0123456789abcdef';
const BODY = JSON.stringify({
  event_id: '6d6d7a3c-0b7d-4a1f-9d1b-1f2e3d4c5b6a',
  event: 'order.paid',
  occurred_at: '2026-08-24T14:30:00Z',
  organization: { id: 'org', slug: 'di-capprio' },
  data: { order: { id: 'abc' } },
  api_version: 'v1',
});
const NOW = 1_756_050_000;

// Firma de referencia con node:crypto (mismo ejemplo del README del API): garantiza que la
// implementación WebCrypto produce exactamente el mismo HMAC.
function nodeSign(t: number, body: string, secret = SECRET) {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}

describe('verifyWebhookSignature', () => {
  it('acepta una firma válida dentro de la tolerancia', async () => {
    const header = nodeSign(NOW - 30, BODY);
    const result = await verifyWebhookSignature(BODY, header, SECRET, { now: NOW });
    expect(result).toEqual({ ok: true, timestamp: NOW - 30 });
  });

  it('signWebhookPayload produce la misma firma que node:crypto', async () => {
    expect(await signWebhookPayload(SECRET, BODY, NOW)).toBe(nodeSign(NOW, BODY));
  });

  it('rechaza un body alterado', async () => {
    const header = nodeSign(NOW, BODY);
    const tampered = BODY.replace('order.paid', 'order.created');
    const result = await verifyWebhookSignature(tampered, header, SECRET, { now: NOW });
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rechaza un secreto distinto', async () => {
    const header = nodeSign(NOW, BODY, 'whsec_otro');
    const result = await verifyWebhookSignature(BODY, header, SECRET, { now: NOW });
    expect(result).toEqual({ ok: false, reason: 'signature_mismatch' });
  });

  it('rechaza timestamps fuera de la ventana de 5 minutos (replay)', async () => {
    const old = await verifyWebhookSignature(BODY, nodeSign(NOW - 301, BODY), SECRET, { now: NOW });
    expect(old).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
    const future = await verifyWebhookSignature(BODY, nodeSign(NOW + 301, BODY), SECRET, { now: NOW });
    expect(future).toEqual({ ok: false, reason: 'timestamp_out_of_tolerance' });
    const edge = await verifyWebhookSignature(BODY, nodeSign(NOW - 300, BODY), SECRET, { now: NOW });
    expect(edge.ok).toBe(true);
  });

  it('rechaza header ausente o malformado', async () => {
    expect(await verifyWebhookSignature(BODY, null, SECRET, { now: NOW })).toEqual({ ok: false, reason: 'missing_header' });
    expect(await verifyWebhookSignature(BODY, 'garbage', SECRET, { now: NOW })).toEqual({ ok: false, reason: 'malformed_header' });
    expect(await verifyWebhookSignature(BODY, `t=${NOW}`, SECRET, { now: NOW })).toEqual({ ok: false, reason: 'malformed_header' });
    expect(await verifyWebhookSignature(BODY, `t=${NOW},v1=notahex`, SECRET, { now: NOW })).toEqual({ ok: false, reason: 'malformed_header' });
  });

  it('acepta cuando alguna de varias v1 coincide (rotación de secreto)', async () => {
    const good = nodeSign(NOW, BODY).split(',')[1];
    const bad = nodeSign(NOW, BODY, 'whsec_viejo').split(',')[1];
    const header = `t=${NOW},${bad},${good}`;
    expect((await verifyWebhookSignature(BODY, header, SECRET, { now: NOW })).ok).toBe(true);
  });
});

describe('parseSignatureHeader', () => {
  it('tolera espacios y orden arbitrario', () => {
    const parsed = parseSignatureHeader(` v1=${'a'.repeat(64)} , t=123 `);
    expect(parsed).toEqual({ t: 123, v1: ['a'.repeat(64)] });
  });
});

describe('normalizeWebhookEvent', () => {
  const automation = {
    event: 'order.stage_changed',
    order: {
      id: '3f9c2a10-1111-4d2e-9b3a-000000000001',
      tracking_code: 'ABC123',
      order_number: 1043,
      stage_from: 'NEW',
      stage_to: 'PREPARING',
      order_type: 'delivery',
      order_origin: 'web',
      source: null,
      total: 45000,
      currency: 'COP',
      customer: { name: 'Ana', phone: '+573001112233' },
    },
    organization: { id: 'org', slug: 'di-capprio', name: 'Di Capprio' },
    sent_at: '2026-08-24T14:30:00Z',
  };

  it('reconoce el envelope v1 y deduplica por event_id', () => {
    const result = normalizeWebhookEvent(JSON.parse(BODY));
    expect(result?.source).toBe('endpoint');
    expect(result?.event).toBe('order.paid');
    expect(result?.dedupeKey).toBe('6d6d7a3c-0b7d-4a1f-9d1b-1f2e3d4c5b6a');
    expect(result?.occurredAt).toBe('2026-08-24T14:30:00Z');
    expect(result?.organizationSlug).toBe('di-capprio');
  });

  it('acepta el payload de Automatizaciones (sin event_id) y deriva la clave de la transición', () => {
    const result = normalizeWebhookEvent(automation);
    expect(result?.source).toBe('automation');
    expect(result?.event).toBe('order.stage_changed');
    expect(result?.dedupeKey).toBe('order.stage_changed:3f9c2a10-1111-4d2e-9b3a-000000000001:NEW:PREPARING');
    expect(result?.occurredAt).toBe('2026-08-24T14:30:00Z');
    expect(result?.organizationSlug).toBe('di-capprio');
  });

  it('un reintento de Automatización repite la clave; otra transición de la misma orden no', () => {
    const dedupe = new InMemoryEventDedupe();
    const first = normalizeWebhookEvent(automation)!;
    const retry = normalizeWebhookEvent({ ...automation, sent_at: '2026-08-24T14:31:00Z' })!;
    const next = normalizeWebhookEvent({ ...automation, order: { ...automation.order, stage_from: 'PREPARING', stage_to: 'READY' } })!;
    expect(dedupe.markIfNew(first.dedupeKey)).toBe(true);
    expect(dedupe.markIfNew(retry.dedupeKey)).toBe(false);
    expect(dedupe.markIfNew(next.dedupeKey)).toBe(true);
  });

  it('tolera stage_from/stage_to nulos (order.created / order.paid de Automatizaciones)', () => {
    const result = normalizeWebhookEvent({
      ...automation,
      event: 'order.created',
      order: { ...automation.order, order_number: null, stage_from: null, stage_to: 'NEW' },
    });
    expect(result?.dedupeKey).toBe('order.created:3f9c2a10-1111-4d2e-9b3a-000000000001::NEW');
  });

  it('rechaza bodies que no son ni envelope ni Automatización', () => {
    expect(normalizeWebhookEvent(null)).toBeNull();
    expect(normalizeWebhookEvent('order.paid')).toBeNull();
    expect(normalizeWebhookEvent({})).toBeNull();
    expect(normalizeWebhookEvent({ event: '' })).toBeNull();
    expect(normalizeWebhookEvent({ event: 'order.paid' })).toBeNull(); // sin event_id ni order.id
    expect(normalizeWebhookEvent({ event: 'order.paid', order: {} })).toBeNull();
    expect(normalizeWebhookEvent({ event_id: 'x', data: {} })).toBeNull(); // sin event
  });
});

describe('InMemoryEventDedupe', () => {
  it('marca el primer evento como nuevo y los repetidos como vistos', () => {
    const dedupe = new InMemoryEventDedupe(2);
    expect(dedupe.markIfNew('a')).toBe(true);
    expect(dedupe.markIfNew('a')).toBe(false);
    expect(dedupe.markIfNew('b')).toBe(true);
    expect(dedupe.markIfNew('c')).toBe(true); // expulsa 'a'
    expect(dedupe.markIfNew('a')).toBe(true);
  });
});

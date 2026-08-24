import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { InMemoryEventDedupe, parseSignatureHeader, signWebhookPayload, verifyWebhookSignature } from './webhooks';

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

import { NextResponse } from 'next/server';
import { InMemoryEventDedupe, SIGNATURE_HEADER, normalizeWebhookEvent, verifyWebhookSignature } from '@/lib/recompry/webhooks';

// Receptor de webhooks de Recompry. Dos emisores firman con el mismo header:
// - `POST /v1/webhook-endpoints` (API, scope webhooks:manage): envelope v1 con `event_id`.
//   Eventos: order.created, order.paid, order.stage_changed, subscription.*, ping.
// - Configuración → Automatizaciones (dashboard, acción "webhook"): `{ event, order, … }` sin
//   `event_id`. Se acepta igual: responder 400 marcaría la regla como fallida en el dashboard.
// En ambos casos guarda el secreto (whsec_…, se muestra UNA sola vez) en RECOMPRY_WEBHOOK_SECRET.
//
// Responde 2xx rápido; si no, el emisor reintenta hasta 5 veces (por eso el dedupe).
const dedupe = new InMemoryEventDedupe(1000);

export async function POST(req: Request) {
  const secret = process.env.RECOMPRY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] RECOMPRY_WEBHOOK_SECRET no está configurado');
    return NextResponse.json({ ok: false, code: 'webhook_not_configured', error: 'Webhook sin secreto.' }, { status: 500 });
  }

  // Firma sobre el body CRUDO: nunca parsear antes de verificar.
  const rawBody = await req.text();
  const verification = await verifyWebhookSignature(rawBody, req.headers.get(SIGNATURE_HEADER), secret);
  if (!verification.ok) {
    console.warn('[webhook] firma rechazada:', verification.reason);
    return NextResponse.json({ ok: false, code: 'invalid_signature', error: verification.reason }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json', error: 'Body inválido.' }, { status: 400 });
  }
  const event = normalizeWebhookEvent(parsed);
  if (!event) {
    return NextResponse.json(
      { ok: false, code: 'invalid_event', error: 'Evento sin `event`, o sin `event_id` (API) ni `order.id` (Automatización).' },
      { status: 400 },
    );
  }

  if (!dedupe.markIfNew(event.dedupeKey)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Aquí va tu lógica (enviar un correo, sincronizar un ERP, avisar por WhatsApp…).
  // Mantén esto rápido; para trabajo pesado encola (Cloudflare Queues) y responde 200.
  console.log('[webhook]', event.source, event.event, event.dedupeKey, {
    occurred_at: event.occurredAt,
    organization: event.organizationSlug,
    header_event: req.headers.get('x-recompry-event'),
  });

  switch (event.event) {
    case 'ping':
      break;
    case 'order.created':
    case 'order.paid':
    case 'order.stage_changed':
      // API: `event.payload.data` trae la orden (shape del "Contrato de entrega" del API).
      // Automatización: `event.payload.order` trae un resumen (id, tracking_code, stage_to, total…).
      break;
    default:
      // Eventos nuevos pueden aparecer sin cambio de versión: ignóralos con 200.
      break;
  }

  return NextResponse.json({ received: true });
}

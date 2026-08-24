import { NextResponse } from 'next/server';
import {
  InMemoryEventDedupe,
  SIGNATURE_HEADER,
  verifyWebhookSignature,
  type RecompryWebhookEvent,
} from '@/lib/recompry/webhooks';

// Receptor de webhooks de Recompry. Regístralo con `POST /v1/webhook-endpoints`
// (scope webhooks:manage) apuntando a https://<tu-dominio>/api/webhooks/recompry y guarda el
// `secret` (whsec_…) que devuelve UNA sola vez en RECOMPRY_WEBHOOK_SECRET.
//
// Eventos v1: order.created, order.paid, order.stage_changed, subscription.*, ping.
// Responde 2xx rápido; si no, el API reintenta hasta 5 veces (por eso el dedupe por event_id).
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

  let event: RecompryWebhookEvent;
  try {
    event = JSON.parse(rawBody) as RecompryWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_json', error: 'Body inválido.' }, { status: 400 });
  }
  if (!event?.event_id || !event?.event) {
    return NextResponse.json({ ok: false, code: 'invalid_event', error: 'Evento sin event_id/event.' }, { status: 400 });
  }

  if (!dedupe.markIfNew(event.event_id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Aquí va tu lógica (enviar un correo, sincronizar un ERP, avisar por WhatsApp…).
  // Mantén esto rápido; para trabajo pesado encola (Cloudflare Queues) y responde 200.
  console.log('[webhook]', event.event, event.event_id, {
    occurred_at: event.occurred_at,
    organization: event.organization?.slug,
    header_event: req.headers.get('x-recompry-event'),
  });

  switch (event.event) {
    case 'ping':
      break;
    case 'order.created':
    case 'order.paid':
    case 'order.stage_changed':
      // event.data trae la orden (mismo shape que GET /v1/orders/{id}).
      break;
    default:
      // Eventos nuevos pueden aparecer sin cambio de versión: ignóralos con 200.
      break;
  }

  return NextResponse.json({ received: true });
}

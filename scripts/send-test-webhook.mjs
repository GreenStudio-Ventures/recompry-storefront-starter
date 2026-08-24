#!/usr/bin/env node
// Envía un webhook firmado (como lo haría Recompry) a tu endpoint local para probar la verificación.
//
//   RECOMPRY_WEBHOOK_SECRET=whsec_… node scripts/send-test-webhook.mjs [url] [--bad-signature] [--old] [--automation]
//
// Por defecto apunta a http://localhost:3000/api/webhooks/recompry y usa el secreto de .env.local.
// `--automation` envía el payload de Configuración → Automatizaciones (sin event_id) en vez del envelope v1.
import { createHmac, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import process from 'node:process';

for (const file of ['.env.local', '.dev.vars']) {
  if (process.env.RECOMPRY_WEBHOOK_SECRET || !existsSync(file)) continue;
  // process.loadEnvFile existe desde Node 20.12 (engines lo exige); con uno más viejo el
  // TypeError críptico se cambia por un mensaje accionable.
  if (typeof process.loadEnvFile !== 'function') {
    console.error(`Node ${process.version} no trae process.loadEnvFile: usa Node >= 20.12 o exporta RECOMPRY_WEBHOOK_SECRET.`);
    process.exit(1);
  }
  process.loadEnvFile(file);
}

const args = process.argv.slice(2);
const url = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:3000/api/webhooks/recompry';
const badSignature = args.includes('--bad-signature');
const old = args.includes('--old');
const automation = args.includes('--automation');
const secret = process.env.RECOMPRY_WEBHOOK_SECRET;
if (!secret) {
  console.error('Falta RECOMPRY_WEBHOOK_SECRET (en .env.local o en el entorno).');
  process.exit(1);
}

const event = automation
  ? {
      // Shape de cf-re-app OrderEventPayload (Automatizaciones): sin event_id ni data.
      event: 'order.stage_changed',
      order: {
        id: randomUUID(),
        tracking_code: 'DEMO123',
        order_number: 1,
        stage_from: 'NEW',
        stage_to: 'PREPARING',
        order_type: 'delivery',
        order_origin: 'web',
        source: null,
        total: 45000,
        currency: 'COP',
        customer: { name: 'Prueba', phone: null },
      },
      organization: { id: '00000000-0000-0000-0000-000000000000', slug: 'demo', name: 'Demo' },
      sent_at: new Date().toISOString(),
    }
  : {
      event_id: randomUUID(),
      event: 'ping',
      occurred_at: new Date().toISOString(),
      organization: { id: '00000000-0000-0000-0000-000000000000', slug: 'demo' },
      data: { message: 'Hola desde send-test-webhook.mjs' },
      api_version: 'v1',
    };
const body = JSON.stringify(event);
const t = Math.floor(Date.now() / 1000) - (old ? 3600 : 0);
const v1 = createHmac('sha256', badSignature ? `${secret}-mal` : secret).update(`${t}.${body}`).digest('hex');

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-recompry-signature': `t=${t},v1=${v1}`,
    'x-recompry-event': event.event,
    ...(event.event_id ? { 'x-recompry-event-id': event.event_id } : {}),
  },
  body,
});
console.log(`${res.status} ${res.statusText}`, await res.text());
process.exit(res.ok ? 0 : 2);

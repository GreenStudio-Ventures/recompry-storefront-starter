import { handle, ok, readJson, badRequest, requireBuyer } from '@/lib/api-route';
import { serverApi, idempotencyKey } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';
import type { components } from '@/lib/recompry/schema';

type CreateSubscriptionRequest = components['schemas']['CreateSubscriptionRequest'];

// Contrata un plan (flujo separado del carrito: exige comprador autenticado).
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<CreateSubscriptionRequest>(req);
    if (!body?.plan_id || !body?.frequency_option_id) badRequest('plan_required', 'Elige un plan y una frecuencia.');
    const buyer = await requireBuyer();
    const result = await serverApi(buyer.access_token).POST('/v1/subscriptions', {
      body,
      headers: { 'Idempotency-Key': idempotencyKey(req.headers.get('idempotency-key')) },
    });
    // `deduped` viaja fuera de `data`: sin reenviarlo la UI anuncia «creada» cuando el API
    // devolvió un contrato vivo ya existente (CreateSubscriptionResponse).
    const created = unwrap(result);
    return ok({ ...created.data, deduped: created.deduped }, result.response.status === 201 ? 201 : 200);
  });
}

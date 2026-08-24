import { handle, ok, readJson, badRequest, optionalBuyer } from '@/lib/api-route';
import { serverApi, idempotencyKey } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';
import type { CreateOrderRequest } from '@/lib/recompry/types';

// Crea la orden. El servidor de Recompry vuelve a cotizar TODO (nunca se aceptan montos del
// cliente salvo propina/canjes). `Idempotency-Key` la genera el browser una vez por intento de
// compra y se reenvía tal cual: reintentar devuelve la misma orden en vez de duplicarla.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<CreateOrderRequest>(req);
    if (!body?.mode || !Array.isArray(body.items) || body.items.length === 0) badRequest('invalid_cart', 'El carrito está vacío.');
    if (!body.payment_method) badRequest('payment_method_required', 'Elige un método de pago.');

    const buyer = await optionalBuyer();
    if (!buyer && (!body.customer?.name || !body.customer?.phone)) {
      badRequest('customer_required', 'Necesitamos tu nombre y teléfono para contactarte.');
    }

    const key = idempotencyKey(req.headers.get('idempotency-key'));
    const result = await serverApi(buyer?.access_token).POST('/v1/orders', {
      body,
      headers: { 'Idempotency-Key': key },
    });
    const order = unwrap(result).data;
    return ok(order, result.response.status === 201 ? 201 : 200);
  });
}

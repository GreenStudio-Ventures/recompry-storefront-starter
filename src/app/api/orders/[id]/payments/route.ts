import { handle, ok, readJson, badRequest, orderAccess } from '@/lib/api-route';
import { serverApi, idempotencyKey } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';
import type { CreatePaymentRequest } from '@/lib/recompry/types';

// Inicia el cobro de una orden creada con un método wompi_*. El monto SIEMPRE es el
// grand_total de la orden (nada viene del cliente). El token de tarjeta lo produce Wompi JS
// en el browser con la public_key de GET /v1/payments/config (ver components/checkout/PaymentStep.tsx).
// Un rechazo del banco ANULA la orden, así que `orderAccess` exige uuid + (sesión con
// X-Buyer-Token | orden creada por este navegador): "sin X-Buyer-Token la key secreta puede
// consultar cualquier orden de la tienda por order_number" (doc del API).
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const buyer = await orderAccess(id);
    const body = await readJson<CreatePaymentRequest>(req);
    if (!body?.method) badRequest('method_required', 'Falta el método de pago.');

    const key = idempotencyKey(req.headers.get('idempotency-key'));
    const result = await serverApi(buyer?.access_token).POST('/v1/orders/{order_id}/payments', {
      params: { path: { order_id: id } },
      body,
      headers: { 'Idempotency-Key': key },
    });
    return ok(unwrap(result).data, result.response.status === 201 ? 201 : 200);
  });
}

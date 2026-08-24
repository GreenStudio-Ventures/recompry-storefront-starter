import { handle, ok, orderAccess } from '@/lib/api-route';
import { serverApi } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';

// Estado del pago (para sondear mientras `final` sea false: 3DS, Nequi, PSE…).
// Cada sondeo tiene efectos de reconciliación en el API (rechazada => anula la orden), así que
// `orderAccess` exige uuid + (sesión con X-Buyer-Token | orden creada por este navegador):
// "sin X-Buyer-Token la key secreta puede consultar cualquier orden de la tienda por order_number".
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const buyer = await orderAccess(id);
    const status = unwrap(
      await serverApi(buyer?.access_token).GET('/v1/orders/{order_id}/payment', { params: { path: { order_id: id } } }),
    );
    return ok(status.data);
  });
}

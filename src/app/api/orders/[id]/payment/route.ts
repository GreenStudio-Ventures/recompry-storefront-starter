import { handle, ok, optionalBuyer } from '@/lib/api-route';
import { serverApi } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';

// Estado del pago (para sondear mientras `final` sea false: 3DS, Nequi, PSE…).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const buyer = await optionalBuyer();
    const status = unwrap(
      await serverApi(buyer?.access_token).GET('/v1/orders/{order_id}/payment', { params: { path: { order_id: id } } }),
    );
    return ok(status.data);
  });
}

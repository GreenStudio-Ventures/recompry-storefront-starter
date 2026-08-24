import { handle, ok, requireBuyer } from '@/lib/api-route';
import { serverApi } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const buyer = await requireBuyer();
    unwrap(
      await serverApi(buyer.access_token).DELETE('/v1/customers/me/addresses/{address_id}', {
        params: { path: { address_id: id } },
      }),
    );
    return ok({ removed: true });
  });
}

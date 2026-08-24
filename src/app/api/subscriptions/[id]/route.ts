import { handle, ok, readJson, badRequest, requireBuyer } from '@/lib/api-route';
import { serverApi } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';

type Action = 'pause' | 'resume' | 'cancel';

// Acciones del comprador sobre su suscripción: pausar, reanudar o cancelar.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const { action, reason } = await readJson<{ action?: Action; reason?: string | null }>(req);
    if (action !== 'pause' && action !== 'resume' && action !== 'cancel') badRequest('invalid_action', 'Acción inválida.');
    const buyer = await requireBuyer();
    const api = serverApi(buyer.access_token);
    const params = { path: { id } };
    const body = { reason: reason ?? null };
    const result =
      action === 'pause'
        ? await api.POST('/v1/subscriptions/{id}/pause', { params, body })
        : action === 'resume'
          ? await api.POST('/v1/subscriptions/{id}/resume', { params, body })
          : await api.POST('/v1/subscriptions/{id}/cancel', { params, body });
    return ok(unwrap(result).data);
  });
}

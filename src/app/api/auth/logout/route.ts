import { handle, ok } from '@/lib/api-route';
import { clearBuyerSession } from '@/lib/recompry/session';

export async function POST() {
  return handle(async () => {
    await clearBuyerSession();
    return ok({ signed_out: true });
  });
}

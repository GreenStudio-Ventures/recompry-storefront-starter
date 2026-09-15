import { handle, ok } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';

// Bancos de PSE para el selector del checkout. Lista pública (misma key publicable que
// `/api/payments/config`); llega vacía si la tienda no habilitó PSE.
export async function GET() {
  return handle(async () => {
    const institutions = unwrap(await publicApi().GET('/v1/payments/pse-institutions'));
    return ok(institutions.data);
  });
}

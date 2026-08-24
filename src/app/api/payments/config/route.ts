import { handle, ok } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';

// Pasarela conectada (Wompi): llave pública + ambiente para tokenizar en el browser.
export async function GET() {
  return handle(async () => {
    const config = unwrap(await publicApi().GET('/v1/payments/config'));
    return ok(config.data);
  });
}

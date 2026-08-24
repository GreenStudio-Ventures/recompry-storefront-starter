import { handle, ok, readJson, badRequest, optionalBuyer } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';
import type { CartQuoteRequest } from '@/lib/recompry/types';

// Totales reales del carrito (precios, descuentos, cupón, envío, propina, impuestos).
// Sin efectos secundarios: se llama cada vez que cambia el carrito.
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<CartQuoteRequest>(req);
    if (!body?.mode || !Array.isArray(body.items) || body.items.length === 0) {
      badRequest('invalid_cart', 'El carrito está vacío.');
    }
    const buyer = await optionalBuyer();
    const quote = unwrap(await publicApi(buyer?.access_token).POST('/v1/cart/quote', { body }));
    return ok(quote.data);
  });
}

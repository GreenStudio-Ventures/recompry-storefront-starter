import { handle, ok, readJson, badRequest } from '@/lib/api-route';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';
import type { ShippingQuoteRequest } from '@/lib/recompry/types';

// Cobertura y costo de envío para una dirección (texto libre geocodificado o lat/lng).
export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<ShippingQuoteRequest>(req);
    if (!body?.address) badRequest('address_required', 'Escribe la dirección de entrega.');
    const quote = unwrap(await publicApi().POST('/v1/shipping/quote', { body }));
    return ok(quote.data);
  });
}

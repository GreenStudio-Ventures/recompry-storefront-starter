import { handle, ok, readJson, badRequest, requireBuyer } from '@/lib/api-route';
import { serverApi, idempotencyKey } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';
import type { CreateAddressBody } from '@/lib/recompry/types';

export async function POST(req: Request) {
  return handle(async () => {
    const body = await readJson<CreateAddressBody>(req);
    if (!body?.line1?.trim()) badRequest('line1_required', 'Escribe la dirección.');
    const buyer = await requireBuyer();
    const result = await serverApi(buyer.access_token).POST('/v1/customers/me/addresses', {
      body,
      headers: { 'Idempotency-Key': idempotencyKey(req.headers.get('idempotency-key')) },
    });
    return ok(unwrap(result).data, result.response.status === 201 ? 201 : 200);
  });
}

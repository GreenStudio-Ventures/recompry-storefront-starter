import { handle, ok, readJson, badRequest, optionalBuyer } from '@/lib/api-route';
import { serverApi, idempotencyKey } from '@/lib/recompry/server';
import { unwrap } from '@/lib/recompry/errors';

// Inscripción en lista de espera de un producto en pre-lanzamiento. Con sesión queda ligada
// a la cuenta; sin sesión exige `email` (invitado).
export async function POST(req: Request) {
  return handle(async () => {
    const { product_id, email } = await readJson<{ product_id?: string; email?: string }>(req);
    if (!product_id) badRequest('product_required', 'Falta el producto.');
    const buyer = await optionalBuyer();
    const cleanEmail = (email ?? '').trim().toLowerCase();
    if (!buyer && !cleanEmail) badRequest('email_required', 'Déjanos tu correo para avisarte.');

    const result = await serverApi(buyer?.access_token).POST('/v1/waitlist', {
      body: buyer ? { product_id } : { product_id, email: cleanEmail },
      headers: { 'Idempotency-Key': idempotencyKey(null) },
    });
    return ok(unwrap(result).data, result.response.status === 201 ? 201 : 200);
  });
}

// Tokenización de tarjetas con Wompi desde el browser (llave PÚBLICA de GET /v1/payments/config).
//
// TODO(wompi): este starter deja el flujo CABLEADO pero no verificado contra la doc oficial:
//   - Verifica el endpoint/campos en https://docs.wompi.co (Tokenización de tarjetas) o usa
//     Wompi JS / el Widget para que la tarjeta nunca toque tu página (menor alcance PCI: capturar
//     el PAN en tu propio formulario te pone en SAQ A-EP).
//   - Agrega el script anti-fraude de Wompi y pasa `session_id`/`device_id` en el pago.
//   - En `environment: 'sandbox'` usa tarjetas de prueba (p.ej. 4242 4242 4242 4242, cualquier
//     fecha futura y CVC); APPROVED/DECLINED se simulan por el número.
export type WompiCardInput = {
  number: string;
  cvc: string;
  exp_month: string; // MM
  exp_year: string; // YY
  card_holder: string;
};

export async function tokenizeCardWithWompi(publicKey: string, environment: 'sandbox' | 'production' | null, card: WompiCardInput): Promise<string> {
  const base = environment === 'production' ? 'https://production.wompi.co/v1' : 'https://sandbox.wompi.co/v1';
  const res = await fetch(`${base}/tokens/cards`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${publicKey}` },
    body: JSON.stringify({
      number: card.number.replace(/\s+/g, ''),
      cvc: card.cvc,
      exp_month: card.exp_month.padStart(2, '0'),
      exp_year: card.exp_year.slice(-2),
      card_holder: card.card_holder.trim(),
    }),
  });
  const json = (await res.json().catch(() => null)) as { data?: { id?: string }; error?: { reason?: string; messages?: unknown } } | null;
  if (!res.ok || !json?.data?.id) {
    throw new Error(json?.error?.reason ?? 'Wompi no pudo tokenizar la tarjeta. Revisa los datos.');
  }
  return json.data.id; // tok_prod_… / tok_test_…
}

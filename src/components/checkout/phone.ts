// El contrato acepta teléfonos de 5+ caracteres al crear la orden (`OrderCustomerInput.phone`)
// pero exige 7+ al cobrar con tarjeta (`PaymentCustomerInput.phone`, minLength 7). Validar
// con 5 dejaba órdenes `wompi_cards` creadas y sin pagar: el cobro respondía 400 de validación.
export const CHECKOUT_PHONE_MIN = 7;
export const CHECKOUT_PHONE_MAX = 30;

export function isCheckoutPhone(phone: string): boolean {
  const len = phone.trim().length;
  return len >= CHECKOUT_PHONE_MIN && len <= CHECKOUT_PHONE_MAX;
}

/** `phone` es opcional en el pago: mejor omitirlo que mandar uno que el API rechazará. */
export function paymentPhone(phone: string | null | undefined): string | undefined {
  const trimmed = (phone ?? '').trim();
  return isCheckoutPhone(trimmed) ? trimmed : undefined;
}

/**
 * Celular colombiano en formato local (10 dígitos) a partir de lo que el comprador haya escrito
 * (`+57 300 111 2233`, `57 300…`, con espacios o guiones). Es lo que exigen Nequi (`^3\d{9}$`) y
 * la base sobre la que PSE arma el `57XXXXXXXXXX` que normaliza el API.
 */
export function localMobile(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '').slice(-10);
}

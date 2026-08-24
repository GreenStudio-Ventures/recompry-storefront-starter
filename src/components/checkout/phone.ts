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

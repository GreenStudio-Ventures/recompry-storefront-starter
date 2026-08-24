import { describe, expect, it } from 'vitest';
import { isCheckoutPhone, paymentPhone } from './phone';

describe('teléfono del checkout (mínimo común orden + pago)', () => {
  it('rechaza los 5–6 caracteres que la orden aceptaría pero el pago con tarjeta no', () => {
    expect(isCheckoutPhone('12345')).toBe(false);
    expect(isCheckoutPhone(' 123456 ')).toBe(false);
    expect(isCheckoutPhone('3001112')).toBe(true);
    expect(isCheckoutPhone('+57 300 111 2233')).toBe(true);
    expect(isCheckoutPhone('1'.repeat(31))).toBe(false);
  });

  it('paymentPhone omite el campo (opcional) en vez de mandar uno inválido', () => {
    expect(paymentPhone('12345')).toBeUndefined();
    expect(paymentPhone(undefined)).toBeUndefined();
    expect(paymentPhone(' +573001112233 ')).toBe('+573001112233');
  });
});

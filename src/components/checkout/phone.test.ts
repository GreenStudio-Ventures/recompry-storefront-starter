import { describe, expect, it } from 'vitest';
import { isCheckoutPhone, localMobile, paymentPhone } from './phone';

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

describe('localMobile (celular local de 10 dígitos para Nequi y PSE)', () => {
  it('normaliza los formatos con los que la gente escribe su número', () => {
    expect(localMobile('+57 300 111 2233')).toBe('3001112233');
    expect(localMobile('573001112233')).toBe('3001112233');
    expect(localMobile('300-111-2233')).toBe('3001112233');
    expect(localMobile('3001112233')).toBe('3001112233');
  });

  it('no inventa dígitos: lo corto se queda corto y lo vacío vacío', () => {
    // El formulario exige pattern="\d{10}", así que esto nunca llega al API; si llegara, el
    // servidor responde 400 (PSE exige >= 12 dígitos tras anteponer el 57).
    expect(localMobile('300111')).toBe('300111');
    expect(localMobile('')).toBe('');
    expect(localMobile(null)).toBe('');
  });

  it('PSE arma 57 + local = los 12 dígitos que normaliza el API', () => {
    expect(`57${localMobile('+57 300 111 2233')}`).toBe('573001112233');
  });
});

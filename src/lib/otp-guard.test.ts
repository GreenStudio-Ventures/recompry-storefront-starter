import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkOtpLimits, clientIp, isValidEmail, normalizeEmail, resetOtpGuardWarnings, type RateLimiterBinding } from './otp-guard';

// Binding falso: registra las claves consultadas y responde según `allow`.
function fakeLimiter(allow: boolean | ((key: string) => boolean)) {
  const keys: string[] = [];
  const limiter: RateLimiterBinding = {
    async limit({ key }) {
      keys.push(key);
      return { success: typeof allow === 'function' ? allow(key) : allow };
    },
  };
  return { limiter, keys };
}

describe('isValidEmail', () => {
  it('acepta correos normales', () => {
    expect(isValidEmail('ana@example.com')).toBe(true);
    expect(isValidEmail('ana.perez+tienda@sub.example.co')).toBe(true);
  });

  it('rechaza basura que antes pasaba con includes("@")', () => {
    expect(isValidEmail('@')).toBe(false);
    expect(isValidEmail('ana@')).toBe(false);
    expect(isValidEmail('@example.com')).toBe(false);
    expect(isValidEmail('ana@example')).toBe(false);
    expect(isValidEmail('ana @example.com')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });

  it('rechaza correos de más de 200 caracteres', () => {
    const local = 'a'.repeat(190);
    expect(isValidEmail(`${local}@example.com`)).toBe(false);
    expect(isValidEmail(`${'a'.repeat(50)}@example.com`)).toBe(true);
  });
});

describe('normalizeEmail', () => {
  it('recorta y pasa a minúsculas; lo que no es string queda vacío', () => {
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(normalizeEmail(undefined)).toBe('');
    expect(normalizeEmail(42)).toBe('');
  });
});

describe('clientIp', () => {
  it('prefiere cf-connecting-ip sobre x-forwarded-for', () => {
    const headers = new Headers({ 'cf-connecting-ip': '203.0.113.9', 'x-forwarded-for': '198.51.100.1, 10.0.0.1' });
    expect(clientIp(headers)).toBe('203.0.113.9');
  });

  it('usa el primer valor de x-forwarded-for', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 198.51.100.1 , 10.0.0.1' }))).toBe('198.51.100.1');
  });

  it('cae a "unknown" sin headers', () => {
    expect(clientIp(new Headers())).toBe('unknown');
    expect(clientIp(new Headers({ 'x-forwarded-for': '' }))).toBe('unknown');
  });
});

describe('checkOtpLimits', () => {
  beforeEach(() => {
    resetOtpGuardWarnings();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('permite cuando ambos bindings aceptan y usa claves por ip y por correo normalizado', async () => {
    const email = fakeLimiter(true);
    const ip = fakeLimiter(true);
    const result = await checkOtpLimits(
      { OTP_RATE_LIMITER_EMAIL: email.limiter, OTP_RATE_LIMITER_IP: ip.limiter },
      { email: ' Ana@Example.com ', ip: '203.0.113.9' },
    );
    expect(result).toEqual({ allowed: true });
    expect(ip.keys).toEqual(['ip:203.0.113.9']);
    expect(email.keys).toEqual(['email:ana@example.com']);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('bloquea por correo cuando ese bucket se agota', async () => {
    const email = fakeLimiter(false);
    const ip = fakeLimiter(true);
    const result = await checkOtpLimits(
      { OTP_RATE_LIMITER_EMAIL: email.limiter, OTP_RATE_LIMITER_IP: ip.limiter },
      { email: 'ana@example.com', ip: '203.0.113.9' },
    );
    expect(result).toEqual({ allowed: false, scope: 'email' });
  });

  it('bloquea por IP sin consultar el bucket de correo', async () => {
    const email = fakeLimiter(true);
    const ip = fakeLimiter(false);
    const result = await checkOtpLimits(
      { OTP_RATE_LIMITER_EMAIL: email.limiter, OTP_RATE_LIMITER_IP: ip.limiter },
      { email: 'ana@example.com', ip: '203.0.113.9' },
    );
    expect(result).toEqual({ allowed: false, scope: 'ip' });
    expect(email.keys).toEqual([]);
  });

  it('sin bindings (next dev / tests) permite y avisa una sola vez', async () => {
    const ids = { email: 'ana@example.com', ip: 'unknown' };
    expect(await checkOtpLimits({}, ids)).toEqual({ allowed: true });
    expect(await checkOtpLimits(null, ids)).toEqual({ allowed: true });
    expect(await checkOtpLimits(undefined, ids)).toEqual({ allowed: true });
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('con un solo binding presente aplica ese y avisa por el ausente', async () => {
    const ip = fakeLimiter(false);
    const result = await checkOtpLimits({ OTP_RATE_LIMITER_IP: ip.limiter }, { email: 'ana@example.com', ip: '203.0.113.9' });
    expect(result).toEqual({ allowed: false, scope: 'ip' });
    const email = fakeLimiter(true);
    expect(await checkOtpLimits({ OTP_RATE_LIMITER_EMAIL: email.limiter }, { email: 'ana@example.com', ip: '203.0.113.9' })).toEqual({ allowed: true });
    expect(console.warn).toHaveBeenCalledTimes(1);
  });
});

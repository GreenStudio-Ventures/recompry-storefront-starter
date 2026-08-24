import { describe, expect, it } from 'vitest';
import { safeNextPath } from './safe-next';

describe('safeNextPath', () => {
  it('rechaza rutas que el parser WHATWG resuelve a otro host', () => {
    expect(safeNextPath('/\\evil.com')).toBe('/account');
    expect(safeNextPath('//evil.com')).toBe('/account');
    expect(safeNextPath('/\\\\evil.com/x')).toBe('/account');
    // Segmentos vacíos tras colapsar `.`/`..`: el pathname resultante `//evil.com` es protocol-relative.
    expect(safeNextPath('/.//evil.com')).toBe('/account');
    expect(safeNextPath('/..//evil.com')).toBe('/account');
    expect(safeNextPath('/a/..//evil.com')).toBe('/account');
    expect(safeNextPath('/a\\..\\..\\/evil.com')).toBe('/account');
    expect(safeNextPath('/x/../\\/evil.com')).toBe('/account');
    expect(safeNextPath('/./\\evil.com')).toBe('/account');
    expect(safeNextPath('/%2F%2Fevil.com')).toBe('/%2F%2Fevil.com'); // codificado NO es un host: se queda en el sitio
  });

  it('rechaza URLs absolutas y esquemas', () => {
    expect(safeNextPath('https://evil.com')).toBe('/account');
    expect(safeNextPath('javascript:alert(1)')).toBe('/account');
    expect(safeNextPath('mailto:a@b.co')).toBe('/account');
  });

  it('conserva path, query y hash de rutas internas', () => {
    expect(safeNextPath('/account/orders?x=1#y')).toBe('/account/orders?x=1#y');
    expect(safeNextPath('/checkout')).toBe('/checkout');
  });

  it('usa el fallback cuando no hay valor', () => {
    expect(safeNextPath(null)).toBe('/account');
    expect(safeNextPath(undefined)).toBe('/account');
    expect(safeNextPath('')).toBe('/account');
    expect(safeNextPath(null, '/checkout')).toBe('/checkout');
  });

  it('evita el bucle hacia el propio login', () => {
    expect(safeNextPath('/account/login')).toBe('/account');
    expect(safeNextPath('/account/login?next=/x')).toBe('/account');
    expect(safeNextPath('/account/login/')).toBe('/account');
    expect(safeNextPath('/account/loginx')).toBe('/account/loginx');
  });
});

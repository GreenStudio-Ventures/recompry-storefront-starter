import { describe, expect, it } from 'vitest';
import { GUEST_ORDERS_MAX, appendGuestOrderId, isOrderUuid, parseGuestOrderIds, serializeGuestOrderIds } from './guest-orders';

const A = '6f1c2a7e-2f3b-4c1d-9e8f-0a1b2c3d4e5f';
const B = '0b8b6c1e-1a2b-4c3d-8e9f-a1b2c3d4e5f6';

describe('isOrderUuid', () => {
  it('acepta uuids en cualquier caja', () => {
    expect(isOrderUuid(A)).toBe(true);
    expect(isOrderUuid(A.toUpperCase())).toBe(true);
  });

  it('rechaza el consecutivo y cualquier otra cosa (evita enumerar por order_number)', () => {
    expect(isOrderUuid('1043')).toBe(false);
    expect(isOrderUuid('')).toBe(false);
    expect(isOrderUuid(null)).toBe(false);
    expect(isOrderUuid(undefined)).toBe(false);
    expect(isOrderUuid(`${A}x`)).toBe(false);
    expect(isOrderUuid(' ' + A)).toBe(false);
    expect(isOrderUuid('6f1c2a7e2f3b4c1d9e8f0a1b2c3d4e5f')).toBe(false);
  });
});

describe('parseGuestOrderIds', () => {
  it('lee la lista separada por comas ignorando basura y duplicados', () => {
    expect(parseGuestOrderIds(`${A}, 1043 ,${B},${A.toUpperCase()},,junk`)).toEqual([A, B]);
  });

  it('devuelve vacío sin cookie', () => {
    expect(parseGuestOrderIds(undefined)).toEqual([]);
    expect(parseGuestOrderIds('')).toEqual([]);
  });

  it('conserva solo los últimos GUEST_ORDERS_MAX', () => {
    const ids = Array.from({ length: GUEST_ORDERS_MAX + 3 }, (_, i) => `${i.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`);
    expect(parseGuestOrderIds(ids.join(','))).toEqual(ids.slice(-GUEST_ORDERS_MAX));
  });
});

describe('appendGuestOrderId + serializeGuestOrderIds', () => {
  it('añade al final, deduplica y recorta al máximo', () => {
    expect(appendGuestOrderId([], A)).toEqual([A]);
    expect(appendGuestOrderId([A, B], A.toUpperCase())).toEqual([B, A]);
    const full = Array.from({ length: GUEST_ORDERS_MAX }, (_, i) => `${i.toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`);
    const next = appendGuestOrderId(full, A);
    expect(next).toHaveLength(GUEST_ORDERS_MAX);
    expect(next[next.length - 1]).toBe(A);
    expect(next).not.toContain(full[0]);
  });

  it('serializa y vuelve a leer sin pérdida', () => {
    expect(parseGuestOrderIds(serializeGuestOrderIds([A, B]))).toEqual([A, B]);
  });
});

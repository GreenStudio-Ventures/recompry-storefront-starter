import { describe, expect, it } from 'vitest';
import type { CartQuote } from '@/lib/recompry/types';
import type { CartLine } from '@/lib/cart/types';
import { matchQuotedLines, type CartQuoteLine } from './quoted-lines';

const PIZZA = '11111111-1111-4111-8111-111111111111';
const SODA = '22222222-2222-4222-8222-222222222222';

function local(key: string, over: Partial<CartLine> = {}): CartLine {
  return { key, product_id: PIZZA, quantity: 1, modifiers: [], name: 'Pizza', slug: 'pizza', modifier_names: [], unit_price_hint: null, image: null, currency_code: 'COP', ...over };
}

function quoted(over: Partial<CartQuoteLine> = {}): CartQuoteLine {
  return { product_id: PIZZA, variant_id: null, name: 'Pizza', quantity: 1, unit_price: 10000, line_total: 10000, tax: { iva_rate: 0, iva_amount: 0, inc_rate: null, inc_amount: 0 }, modifiers: [], comment: null, ...over };
}

function quote(lines: CartQuoteLine[], issues: CartQuote['issues'] = []): CartQuote {
  return { lines, issues, subtotal: 0, subtotal_before_taxes: 0, discount_total: 0, discounts_applied: [], shipping_amount: 0, shipping: null as unknown as CartQuote['shipping'], tip_amount: 0, credits_redeemed_cents: 0, loyalty_points_redeemed: 0, loyalty_discount: 0, tax_iva_total: 0, tax_inc_total: 0, grand_total: 0, currency_code: 'COP', price_includes_taxes: true };
}

describe('matchQuotedLines', () => {
  it('dos líneas del mismo producto con distintos extras reciben cada una su precio (por posición)', () => {
    const lines = [local('a'), local('b', { modifiers: [{ modifier_set_id: 's', modifier_ids: ['queso'] }], modifier_names: ['Queso extra'] })];
    const q = quote([quoted({ unit_price: 10000 }), quoted({ unit_price: 12500, modifiers: [{ id: 'queso', set_id: 's', name: 'Queso extra', set_name: 'Adiciones', price_delta: 2500 }] })]);
    const m = matchQuotedLines(lines, q);
    expect(m.get('a')?.unit_price).toBe(10000);
    expect(m.get('b')?.unit_price).toBe(12500);
  });

  it('salta las líneas de productos reportados en issues (el API las excluye de `lines`)', () => {
    const lines = [local('soda', { product_id: SODA }), local('a'), local('b', { comment: 'sin cebolla' })];
    const q = quote([quoted({ unit_price: 10000 }), quoted({ unit_price: 10000, comment: 'sin cebolla' })], [{ code: 'out_of_stock', message: 'Agotado', product_id: SODA }]);
    const m = matchQuotedLines(lines, q);
    expect(m.has('soda')).toBe(false);
    expect(m.get('a')?.comment).toBeNull();
    expect(m.get('b')?.comment).toBe('sin cebolla');
  });

  it('empareja aunque la sucursal auto-sirva una variante que el cliente no eligió', () => {
    const m = matchQuotedLines([local('a')], quote([quoted({ variant_id: 'v-auto', unit_price: 9000 })]));
    expect(m.get('a')?.unit_price).toBe(9000);
  });

  it('desalineado (cotización vieja vs carrito editado): cae a clave con extras+comentario sin repetir líneas', () => {
    const lines = [local('a'), local('b', { modifiers: [{ modifier_set_id: 's', modifier_ids: ['queso'] }] }), local('c', { product_id: SODA })];
    const q = quote([quoted({ unit_price: 12500, modifiers: [{ id: 'queso', set_id: 's', name: 'Queso', set_name: 'Adiciones', price_delta: 2500 }] }), quoted({ unit_price: 10000 })]);
    const m = matchQuotedLines(lines, q);
    expect(m.get('a')?.unit_price).toBe(10000);
    expect(m.get('b')?.unit_price).toBe(12500);
    expect(m.has('c')).toBe(false);
  });

  it('sin cotización → mapa vacío (se usa unit_price_hint)', () => {
    expect(matchQuotedLines([local('a')], null).size).toBe(0);
  });
});

import type { CartQuoteRequest } from '@/lib/recompry/types';
import type { CartState } from './types';

/** Body de `POST /v1/cart/quote` (y base de `POST /v1/orders`) a partir del carrito local. */
export function buildQuoteRequest(state: CartState): CartQuoteRequest | null {
  if (!state.lines.length) return null;
  const { mode, location_id, address_text, coupon_code, tip_amount, table_number } = state.context;
  const needsAddress = mode === 'delivery' || mode === 'shipping';
  const address = needsAddress && address_text && address_text.trim().length >= 3 ? { text: address_text.trim(), country: 'CO' } : undefined;
  return {
    mode,
    // Para pickup/dine_in la sede la elige el comprador; para envíos la resuelve la cobertura.
    ...(!needsAddress && location_id ? { location_id } : {}),
    items: state.lines.map((l) => ({
      product_id: l.product_id,
      ...(l.variant_id ? { variant_id: l.variant_id } : {}),
      quantity: l.quantity,
      ...(l.modifiers.length ? { modifiers: l.modifiers } : {}),
      ...(l.comment ? { comment: l.comment } : {}),
    })),
    ...(address ? { address } : {}),
    ...(coupon_code ? { coupon_code } : {}),
    ...(tip_amount && tip_amount > 0 ? { tip_amount } : {}),
    ...(mode === 'dine_in' && table_number ? { table_number } : {}),
  };
}

import type { OrderMode } from '@/lib/recompry/types';

/** Línea del carrito local. Guarda solo ids + snapshot para mostrar; los precios reales los da `POST /v1/cart/quote`. */
export type CartLine = {
  /** Clave estable de la línea (producto + variante + modificadores + comentario). */
  key: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  modifiers: Array<{ modifier_set_id: string; modifier_ids: string[] }>;
  comment?: string;
  // snapshot para render inmediato (antes de cotizar)
  name: string;
  slug: string | null;
  variant_name?: string | null;
  modifier_names: string[];
  unit_price_hint: number | null;
  image: string | null;
  currency_code: string;
};

/** Contexto del pedido elegido por el comprador (persiste junto al carrito). */
export type CheckoutContext = {
  mode: OrderMode;
  location_id?: string;
  address_text?: string;
  coupon_code?: string;
  tip_amount?: number;
  table_number?: string;
};

export type CartState = {
  lines: CartLine[];
  context: CheckoutContext;
};

export function lineKey(input: Pick<CartLine, 'product_id' | 'variant_id' | 'modifiers' | 'comment'>): string {
  const mods = input.modifiers
    .map((m) => `${m.modifier_set_id}:${[...m.modifier_ids].sort().join('+')}`)
    .sort()
    .join('|');
  return [input.product_id, input.variant_id ?? '', mods, (input.comment ?? '').trim()].join('#');
}

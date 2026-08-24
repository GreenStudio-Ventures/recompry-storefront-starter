// Lecturas públicas de la tienda con la key publicable. `cache()` de React dedupe las
// llamadas dentro de un mismo render (layout + page piden la tienda una sola vez).
import { cache } from 'react';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';
import type { Category, Location, Product, Store } from '@/lib/recompry/types';

export const getStore = cache(async (): Promise<Store> => {
  return unwrap(await publicApi().GET('/v1/store')).data;
});

export const getLocations = cache(async (): Promise<Location[]> => {
  return unwrap(await publicApi().GET('/v1/locations')).data;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  return unwrap(await publicApi().GET('/v1/categories', { params: { query: { limit: 100 } } })).data;
});

export type ProductPage = { items: Product[]; nextCursor: string | null };

export async function listProducts(query: {
  category?: string;
  q?: string;
  cursor?: string;
  limit?: number;
  sort?: 'created_at' | '-created_at' | 'price' | '-price' | 'name';
  location_id?: string;
}): Promise<ProductPage> {
  const res = unwrap(
    await publicApi().GET('/v1/products', {
      params: { query: { limit: query.limit ?? 24, ...query } },
    }),
  );
  return { items: res.data, nextCursor: res.meta.next_cursor };
}

export async function getProduct(idOrSlug: string, locationId?: string): Promise<Product> {
  return unwrap(
    await publicApi().GET('/v1/products/{id_or_slug}', {
      params: {
        path: { id_or_slug: idOrSlug },
        query: { include: 'variants,modifiers,subscription_plans', ...(locationId ? { location_id: locationId } : {}) },
      },
    }),
  ).data;
}

/** Modos de pedido habilitados por la tienda, en el vocabulario de `POST /v1/cart/quote`. */
export function enabledModes(store: Store): Array<{ mode: 'pickup' | 'delivery' | 'shipping' | 'dine_in'; label: string }> {
  const t = store.online_order_types;
  const modes: Array<{ mode: 'pickup' | 'delivery' | 'shipping' | 'dine_in'; label: string }> = [];
  if (t.pickup || t.takeout || t.drive_thru) modes.push({ mode: 'pickup', label: 'Recoger en tienda' });
  if (t.delivery_local) modes.push({ mode: 'delivery', label: 'Domicilio' });
  if (t.shipment_national) modes.push({ mode: 'shipping', label: 'Envío nacional' });
  if (t.dine_in) modes.push({ mode: 'dine_in', label: 'En mesa' });
  return modes;
}

export function enabledPaymentMethods(store: Store) {
  const p = store.payment_methods;
  const out: Array<{ code: 'cash_on_delivery' | 'wompi_cards' | 'wompi_pse' | 'wompi_nequi' | 'wompi_bancolombia_button'; label: string }> = [];
  if (p.cash_on_delivery) out.push({ code: 'cash_on_delivery', label: 'Contraentrega / pago al recibir' });
  if (p.wompi_cards) out.push({ code: 'wompi_cards', label: 'Tarjeta de crédito o débito (Wompi)' });
  if (p.wompi_pse) out.push({ code: 'wompi_pse', label: 'PSE (Wompi)' });
  if (p.wompi_nequi) out.push({ code: 'wompi_nequi', label: 'Nequi (Wompi)' });
  if (p.wompi_bancolombia_button) out.push({ code: 'wompi_bancolombia_button', label: 'Botón Bancolombia (Wompi)' });
  return out;
}

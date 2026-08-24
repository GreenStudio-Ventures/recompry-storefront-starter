import type { Metadata } from 'next';
import { CartView } from '@/components/cart/CartView';
import { enabledModes, getLocations, getStore } from '@/lib/store';

export const metadata: Metadata = { title: 'Carrito' };

export default async function CartPage() {
  const [store, locations] = await Promise.all([getStore(), getLocations().catch(() => [])]);
  return (
    <CartView
      currency={store.currency}
      modes={enabledModes(store)}
      locations={locations.map((l) => ({ id: l.id, name: l.name, status_text: l.status_text, is_open: l.is_open, capabilities: l.capabilities }))}
    />
  );
}

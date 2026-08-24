import type { Metadata } from 'next';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { serverApi } from '@/lib/recompry/server';
import { getBuyerSession } from '@/lib/recompry/session';
import { enabledModes, enabledPaymentMethods, getLocations, getStore } from '@/lib/store';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const [store, locations, { session }] = await Promise.all([getStore(), getLocations().catch(() => []), getBuyerSession()]);

  // Prefill con la ficha del comprador si hay sesión (best-effort: con keys de test puede no existir).
  let buyer: { name?: string | null; email?: string | null; phone?: string | null } | null = null;
  if (session) {
    buyer = { email: session.user.email, phone: session.user.phone };
    try {
      const { data } = await serverApi(session.access_token).GET('/v1/customers/me');
      if (data?.data) buyer = { name: data.data.name, email: data.data.email ?? session.user.email, phone: data.data.phone ?? session.user.phone };
    } catch {
      // sin ficha todavía
    }
  }

  return (
    <CheckoutForm
      currency={store.currency}
      modes={enabledModes(store)}
      // El starter implementa contraentrega y tarjeta; PSE/Nequi/Bancolombia quedan como TODO (ver README).
      paymentMethods={enabledPaymentMethods(store).filter((m) => m.code === 'cash_on_delivery' || m.code === 'wompi_cards')}
      locations={locations.map((l) => ({ id: l.id, name: l.name, status_text: l.status_text, is_open: l.is_open, capabilities: l.capabilities }))}
      buyer={buyer}
      loggedIn={Boolean(session)}
    />
  );
}

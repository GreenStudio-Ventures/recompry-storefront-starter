import type { Metadata } from 'next';
import { SessionRefresher } from '@/components/account/SessionRefresher';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { serverApi } from '@/lib/recompry/server';
import { getBuyerSession } from '@/lib/recompry/session';
import { enabledModes, enabledPaymentMethods, getLocations, getStore } from '@/lib/store';

export const metadata: Metadata = { title: 'Checkout' };

export default async function CheckoutPage() {
  const [store, locations, { session, expired }] = await Promise.all([
    getStore(),
    getLocations().catch(() => []),
    // Página: no renueva. Si renovara aquí, `POST /api/orders` encontraría el refresh_token ya
    // consumido y crearía el pedido como invitado en silencio (sin ligarlo a la cuenta).
    getBuyerSession({ refresh: false }),
  ]);
  // Vencida → la renueva un handler y volvemos a renderizar con `loggedIn` real; si no se
  // puede, se limpia la cookie y el checkout sigue como invitado (nunca mandamos al login).
  if (expired) return <SessionRefresher next="/checkout" onFailure="stay" />;

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
    <>
      <CheckoutForm
        currency={store.currency}
        modes={enabledModes(store)}
        // Todos los métodos que la tienda tenga habilitados: contraentrega, tarjeta (con 3-D
        // Secure), PSE, Nequi y Botón Bancolombia. `payment_methods` de `GET /v1/store` ya viene
        // filtrado por si hay integración de Wompi conectada.
        paymentMethods={enabledPaymentMethods(store)}
        locations={locations.map((l) => ({ id: l.id, name: l.name, status_text: l.status_text, is_open: l.is_open, capabilities: l.capabilities }))}
        buyer={buyer}
        // `session` ya es una sesión vigente (no vencida): sin renovar en la página, era mentira a veces.
        loggedIn={Boolean(session)}
      />
    </>
  );
}

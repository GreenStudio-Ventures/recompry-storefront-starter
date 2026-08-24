import type { Metadata } from 'next';
import { SessionRefresher } from '@/components/account/SessionRefresher';
import { CheckoutForm } from '@/components/checkout/CheckoutForm';
import { Notice } from '@/components/ui';
import { publicApi } from '@/lib/recompry/client';
import { serverApi } from '@/lib/recompry/server';
import { getBuyerSession } from '@/lib/recompry/session';
import type { PaymentConfig } from '@/lib/recompry/types';
import { enabledModes, enabledPaymentMethods, getLocations, getStore } from '@/lib/store';

export const metadata: Metadata = { title: 'Checkout' };

// Métodos que el starter todavía no implementa (README → Pendientes / TODO conocidos), en el
// vocabulario de `methods_enabled` de GET /v1/payments/config.
const UNSUPPORTED_ONLINE_METHODS: Array<{ key: 'pse' | 'nequi' | 'bancolombia_button'; label: string }> = [
  { key: 'pse', label: 'PSE' },
  { key: 'nequi', label: 'Nequi' },
  { key: 'bancolombia_button', label: 'Botón Bancolombia' },
];

export default async function CheckoutPage() {
  const [store, locations, { session, expired }, paymentConfig] = await Promise.all([
    getStore(),
    getLocations().catch(() => []),
    // Página: no renueva. Si renovara aquí, `POST /api/orders` encontraría el refresh_token ya
    // consumido y crearía el pedido como invitado en silencio (sin ligarlo a la cuenta).
    getBuyerSession({ refresh: false }),
    publicApi()
      .GET('/v1/payments/config')
      .then((r) => r.data?.data ?? null)
      .catch((): PaymentConfig | null => null),
  ]);
  // Vencida → la renueva un handler y volvemos a renderizar con `loggedIn` real; si no se
  // puede, se limpia la cookie y el checkout sigue como invitado (nunca mandamos al login).
  if (expired) return <SessionRefresher next="/checkout" onFailure="stay" />;

  // `methods_enabled` refleja lo que la tienda realmente conectó en Wompi; sin config (red,
  // key sin store:read) caemos al flag de la tienda para no ocultar el aviso.
  const unsupported = paymentConfig
    ? UNSUPPORTED_ONLINE_METHODS.filter((m) => paymentConfig.methods_enabled[m.key]).map((m) => m.label)
    : enabledPaymentMethods(store)
        .filter((m) => m.code === 'wompi_pse' || m.code === 'wompi_nequi' || m.code === 'wompi_bancolombia_button')
        .map((m) => m.label);

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
      {unsupported.length ? (
        // Sin este aviso, una tienda con solo PSE/Nequi vería "no tiene métodos de pago online"
        // y buscaría el problema en su configuración, cuando el gap está en el starter.
        <Notice tone="warning" className="mb-6">
          Este starter implementa tarjeta y contraentrega; tu tienda también tiene habilitados: {unsupported.join(', ')} (ver README → Pendientes / TODO conocidos).
        </Notice>
      ) : null}
      <CheckoutForm
        currency={store.currency}
        modes={enabledModes(store)}
        // El starter implementa contraentrega y tarjeta; PSE/Nequi/Bancolombia quedan como TODO (ver README).
        paymentMethods={enabledPaymentMethods(store).filter((m) => m.code === 'cash_on_delivery' || m.code === 'wompi_cards')}
        locations={locations.map((l) => ({ id: l.id, name: l.name, status_text: l.status_text, is_open: l.is_open, capabilities: l.capabilities }))}
        buyer={buyer}
        // `session` ya es una sesión vigente (no vencida): sin renovar en la página, era mentira a veces.
        loggedIn={Boolean(session)}
      />
    </>
  );
}

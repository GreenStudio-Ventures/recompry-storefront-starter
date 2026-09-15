'use client';

// Página de retorno del pago: aquí vuelve el comprador desde el portal de su banco (PSE / Botón
// Bancolombia) y también desde el 3-D Secure de la tarjeta.
//
// El retorno NO es la confirmación: Wompi no manda nada que podamos creer en la URL, así que la
// única fuente de verdad es `GET /v1/orders/{id}/payment` (que además reconcilia la venta en el
// API). Por eso esta página solo sondea hasta que el estado sea final.
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { buttonClass, ErrorBanner, LinkButton, Notice, SectionTitle, Spinner } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { clearPendingPayment } from '@/lib/checkout/pending-payment';
import { useCart } from '@/lib/cart/CartProvider';
import type { PaymentStatus } from '@/lib/recompry/types';

const POLL_MS = 2500;
const POLL_MAX_MS = 3 * 60_000;
/** Fallos de consulta SEGUIDOS que se toleran antes de rendirse (~15 s de red intermitente). */
const MAX_FAILS = 6;

export function PaymentReturn({ orderId, trackingCode }: { orderId: string; trackingCode: string | null }) {
  const router = useRouter();
  const { clear } = useCart();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const done = useRef(false);
  const fails = useRef(0);
  const trackHref = `/track/${encodeURIComponent(trackingCode || orderId)}`;

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    const poll = async () => {
      if (cancelled || done.current) return;
      try {
        const next = await callApi<PaymentStatus>(`/api/orders/${orderId}/payment`);
        if (cancelled) return;
        fails.current = 0;
        setError(null);
        setStatus(next);
        if (next.final) {
          done.current = true;
          clearPendingPayment();
          if (next.status === 'approved') {
            // El carrito solo se vacía cuando el cobro cerró bien: si el banco rechaza, la orden
            // queda anulada y el comprador necesita sus productos para volver a pedir.
            clear();
            router.replace(`${trackHref}?nuevo=1&pago=aprobado`);
          }
        }
      } catch (err) {
        if (cancelled) return;
        // Ningún fallo de CONSULTA es terminal: el pago puede estar aprobándose mientras tanto y
        // rendirse aquí dejaría al comprador creyendo que falló (y con el carrito sin vaciar).
        // Solo un 404 (esta orden no es de este navegador) no tiene arreglo sondeando.
        const ui = toUiError(err);
        fails.current += 1;
        if (ui.code === 'order_not_found' || fails.current >= MAX_FAILS) {
          done.current = true;
          setError(ui);
        }
      }
    };

    void poll();
    const timer = setInterval(() => {
      if (done.current) return clearInterval(timer);
      if (Date.now() - startedAt > POLL_MAX_MS) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      void poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId, clear, router, trackHref]);

  const declined = status && (status.status === 'declined' || status.status === 'error');

  return (
    <div className="mx-auto max-w-md">
      <SectionTitle title="Confirmando tu pago" subtitle={trackingCode ? `Pedido ${trackingCode}` : undefined} />

      {error ? (
        <div className="space-y-4">
          <ErrorBanner error={error} title="No pudimos consultar tu pago" />
          <p className="text-sm text-slate-600">Tu pedido sigue en pie. Consúltalo con su código de seguimiento.</p>
          <LinkButton href={trackHref}>Ver mi pedido</LinkButton>
        </div>
      ) : declined ? (
        <div className="space-y-4">
          <ErrorBanner title={status.decline?.title ?? 'Pago rechazado'} error={{ message: status.decline?.message ?? 'Tu banco rechazó la transacción.', code: status.decline?.category }} />
          <p className="text-sm text-slate-600">Un rechazo anula la orden; haz el pedido de nuevo para intentarlo con otro método.</p>
          <LinkButton href="/">Volver a la tienda</LinkButton>
        </div>
      ) : status?.status === 'approved' ? (
        <Notice tone="success">¡Pago aprobado! Te llevamos a tu pedido…</Notice>
      ) : timedOut ? (
        <div className="space-y-4">
          {/* Sin reintento: la transacción sigue viva y el webhook de Wompi la reconcilia. */}
          <Notice tone="info">Tu pago sigue en proceso. Apenas tu banco lo confirme actualizamos el pedido.</Notice>
          <LinkButton href={trackHref}>Ver mi pedido</LinkButton>
        </div>
      ) : (
        <div className="space-y-4">
          <Notice tone="info">
            <span className="inline-flex items-start gap-2">
              <Spinner className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Estamos confirmando tu pago con el banco. No cierres esta página.</span>
            </span>
          </Notice>
          {status?.async_payment_url ? (
            // El comprador volvió sin terminar en el banco: dejarle la puerta abierta evita que
            // haga un pedido nuevo (y un segundo cobro) por una sesión que abandonó.
            <a className={buttonClass('secondary', 'md', 'w-full')} href={status.async_payment_url}>Volver al portal de mi banco</a>
          ) : null}
        </div>
      )}
    </div>
  );
}

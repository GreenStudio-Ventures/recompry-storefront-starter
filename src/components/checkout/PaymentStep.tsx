'use client';

// Cobro online de una orden ya creada (métodos `wompi_*`). Este componente es el SHELL:
//   1. GET /api/payments/config → llave pública, ambiente y tokens de aceptación.
//   2. Pinta el formulario del método con el que se creó la orden (PaymentForms.tsx).
//   3. POST /api/orders/{id}/payments con Idempotency-Key.
//   4. Según el método:
//      · tarjeta  → puede quedar `pending` por 3-D Secure: se monta `three_ds.render_html` en un
//                   iframe (oculto en BROWSER_INFO/FINGERPRINT, visible en CHALLENGE) y se sondea.
//      · PSE / Bancolombia → llega `async_payment_url`: navegación COMPLETA al banco. El banco
//                   devuelve al comprador a /pago/{id}, que sondea hasta el estado final.
//      · Nequi    → no hay a dónde ir: el comprador aprueba el push en su app y aquí se sondea.
// Un rechazo ANULA la orden (el API la deja VOIDED/CANCELED): no se puede reintentar sobre la
// misma orden, hay que crear un pedido nuevo.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, ErrorBanner, LinkButton, Notice, SectionTitle, Spinner } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { clearPendingPayment, savePendingPayment } from '@/lib/checkout/pending-payment';
import { formatMoney } from '@/lib/format';
import type { CreatePaymentRequest, Order, PaymentConfig, PaymentResult, PaymentStatus } from '@/lib/recompry/types';
import { BancolombiaForm, CardForm, NequiForm, PseForm, type PayerContact } from './PaymentForms';

type Props = {
  order: Order;
  customer: PayerContact;
  onPaid: () => void;
  onRestart: () => void;
};

/** Cada cuánto se consulta el estado mientras el pago no es final (cadencia que documenta el API). */
const POLL_MS = 2500;
/** Tope del sondeo en esta página. Al agotarse NO se ofrece reintentar: el webhook reconcilia. */
const POLL_MAX_MS = 3 * 60_000;

const TITLE: Record<string, string> = {
  wompi_cards: 'Pago con tarjeta',
  wompi_pse: 'Pago con PSE',
  wompi_nequi: 'Pago con Nequi',
  wompi_bancolombia_button: 'Pago con Botón Bancolombia',
};

export function PaymentStep({ order, customer, onPaid, onRestart }: Props) {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [configTry, setConfigTry] = useState(0);
  const [error, setError] = useState<UiError | null>(null);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<PaymentResult | PaymentStatus | null>(null);
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const idem = useRef<string>(crypto.randomUUID());
  // El reloj del sondeo vive en un ref: si se declarara dentro del efecto, cada respuesta
  // (que cambia `result`) lo reiniciaría y el tope no se cumpliría nunca.
  const pollStartedAt = useRef<number | null>(null);
  // `onPaid` navega; sin este candado el efecto lo repetiría en cada render.
  const paidOnce = useRef(false);
  const method = order.payment.method;
  const total = formatMoney(order.totals.grand_total, order.totals.currency_code);
  const trackHref = `/track/${encodeURIComponent(order.tracking_code ?? order.id)}`;

  useEffect(() => {
    let alive = true;
    callApi<PaymentConfig>('/api/payments/config')
      .then((c) => { if (alive) setConfig(c); })
      .catch((err) => { if (alive) setError(toUiError(err)); });
    return () => { alive = false; };
  }, [configTry]);

  // Sondeo mientras el pago no sea final (3DS, app del banco, retorno pendiente). La dependencia
  // es un booleano estable, no `result`: así el intervalo no se recrea con cada respuesta.
  const polling = result !== null && !result.final;
  useEffect(() => {
    if (!polling) {
      pollStartedAt.current = null;
      return;
    }
    pollStartedAt.current ??= Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - (pollStartedAt.current ?? Date.now()) > POLL_MAX_MS) {
        clearInterval(timer);
        setPollTimedOut(true);
        return;
      }
      try {
        const status = await callApi<PaymentStatus>(`/api/orders/${order.id}/payment`);
        setResult(status);
        if (status.final) {
          clearPendingPayment();
          clearInterval(timer);
        }
      } catch (err) {
        // 502 wompi_status_failed no es un rechazo: Wompi no respondió. Se sigue sondeando.
        const ui = toUiError(err);
        if (ui.code !== 'wompi_status_failed') setError(ui);
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, order.id]);

  useEffect(() => {
    if (result?.status === 'approved' && !paidOnce.current) {
      paidOnce.current = true;
      onPaid();
    }
  }, [result?.status, onPaid]);

  const pay = useCallback(
    async (body: CreatePaymentRequest) => {
      setPaying(true);
      setError(null);
      pollStartedAt.current = null;
      try {
        const res = await callApi<PaymentResult>(`/api/orders/${order.id}/payments`, {
          body,
          headers: { 'Idempotency-Key': idem.current },
        });
        setResult(res);
        if (res.final) clearPendingPayment();
        else {
          // Antes de poder salir del sitio (PSE/Bancolombia) o de que el comprador cierre la
          // pestaña (Nequi/3DS): dejar el puntero a esta orden para no crear otra al volver.
          savePendingPayment({
            id: order.id,
            tracking_code: order.tracking_code ?? null,
            method,
            total: order.totals.grand_total,
            currency: order.totals.currency_code,
          });
        }
        // PSE / Botón Bancolombia: la autorización ocurre en el banco, con navegación completa.
        if (res.async_payment_url) window.location.assign(res.async_payment_url);
      } catch (err) {
        const ui = toUiError(err);
        // Ya estaba pagada (p.ej. dos pestañas): no es un error para el comprador, se sondea.
        if (ui.code === 'order_already_paid') setResult({ status: 'pending', final: false } as PaymentStatus);
        else setError(ui);
        idem.current = crypto.randomUUID(); // siguiente intento = nueva key
      } finally {
        setPaying(false);
      }
    },
    [order.id, order.tracking_code, order.totals.grand_total, order.totals.currency_code, method],
  );

  const approved = result?.status === 'approved';
  const declined = result && (result.status === 'declined' || result.status === 'error');
  const threeDs = polling ? result!.three_ds : null;
  const bankUrl = polling ? result!.async_payment_url : null;

  const formProps = {
    config: config!,
    contact: customer,
    paying,
    submitLabel: `Pagar ${total}`,
    returnUrl: () => `${window.location.origin}/pago/${order.id}?t=${encodeURIComponent(order.tracking_code ?? '')}`,
    onPay: pay,
    onError: (err: unknown) => setError(toUiError(err)),
  };

  return (
    <div className="mx-auto max-w-lg">
      <SectionTitle title={TITLE[method] ?? 'Pago del pedido'} subtitle={`Pedido #${order.order_number ?? order.id.slice(0, 8)} · ${total}`} />

      {!config && !error ? <div className="flex justify-center py-12 text-slate-400"><Spinner className="h-8 w-8" /></div> : null}

      {config && !config.public_key ? (
        <Notice tone="warning">La tienda no tiene Wompi conectado ({'provider: null'}). Solo acepta contraentrega.</Notice>
      ) : null}

      {approved ? (
        <Notice tone="success">¡Pago aprobado! Te llevamos a tu pedido…</Notice>
      ) : declined ? (
        <div className="space-y-4">
          <ErrorBanner title={result.decline?.title ?? 'Pago rechazado'} error={{ message: result.decline?.message ?? 'El banco rechazó la transacción.', code: result.decline?.category }} />
          <p className="text-sm text-slate-600">Un rechazo anula la orden; crea un pedido nuevo para intentar de nuevo.</p>
          <Button onClick={onRestart}>Volver al checkout</Button>
        </div>
      ) : pollTimedOut ? (
        // Sondeo agotado con el pago aún pendiente: NO se ofrece reintentar (duplicaría el cobro).
        <div className="space-y-4">
          <Notice tone="info">Tu pago sigue en proceso. Apenas tu banco lo confirme actualizamos el pedido.</Notice>
          <LinkButton href={trackHref}>Ver mi pedido</LinkButton>
        </div>
      ) : polling ? (
        <div className="space-y-3">
          <Notice tone="info">
            <span className="inline-flex items-start gap-2">
              <Spinner className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{pendingCopy(method, threeDs?.interactive === true, Boolean(threeDs))}</span>
            </span>
          </Notice>
          {bankUrl ? (
            <Button onClick={() => window.location.assign(bankUrl)} className="w-full">Ir al portal de mi banco</Button>
          ) : null}
          {/* 3-D Secure. BROWSER_INFO y FINGERPRINT traen HTML que se ejecuta solo: va oculto pero
              DEBE montarse o la autenticación no avanza. CHALLENGE es el único que el comprador ve
              y responde. El API ya decodificó el HTML; se monta con `srcDoc` (con `src` no funciona). */}
          {threeDs?.render_html ? (
            threeDs.interactive ? (
              <div className="card overflow-hidden">
                {/* Sello obligatorio por políticas de Mastercard mientras se autentica. */}
                <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  Verificación segura · 3-D Secure
                </div>
                <iframe key={threeDs.step} title="Verificación de tu banco" srcDoc={threeDs.render_html} className="block h-[460px] w-full border-0" allow="clipboard-write" />
              </div>
            ) : (
              <iframe key={threeDs.step} title="Autenticación 3-D Secure" srcDoc={threeDs.render_html} className="pointer-events-none absolute h-0 w-0 border-0 opacity-0" aria-hidden="true" tabIndex={-1} />
            )
          ) : null}
        </div>
      ) : config?.public_key ? (
        <div className="space-y-4">
          <ErrorBanner error={error} />
          {method === 'wompi_cards' ? <CardForm {...formProps} /> : null}
          {method === 'wompi_pse' ? <PseForm {...formProps} /> : null}
          {method === 'wompi_nequi' ? <NequiForm {...formProps} /> : null}
          {method === 'wompi_bancolombia_button' ? <BancolombiaForm {...formProps} /> : null}
          {!TITLE[method] ? <Notice tone="warning">Este starter no implementa el método <span className="font-mono">{method}</span>.</Notice> : null}
        </div>
      ) : (
        // Sin config no hay formulario posible: la orden ya existe, así que hay que dar salidas.
        <div className="space-y-4">
          <ErrorBanner error={error} title="No pudimos cargar el pago" />
          <div className="flex flex-wrap gap-2">
            {/* Limpiar el error aquí (y no en el efecto) deja volver a ver el spinner. */}
            <Button onClick={() => { setError(null); setConfigTry((n) => n + 1); }}>Reintentar</Button>
            <LinkButton href={trackHref} variant="secondary">Ver mi pedido</LinkButton>
          </div>
        </div>
      )}
    </div>
  );
}

function pendingCopy(method: string, challenge: boolean, hasThreeDs: boolean): string {
  if (challenge) return 'Tu banco necesita verificar que eres tú. Completa la verificación aquí abajo — no cierres esta página.';
  if (hasThreeDs) return 'Autenticando tu pago de forma segura con tu banco. No cierres esta página.';
  if (method === 'wompi_nequi') return 'Abre tu app Nequi y aprueba el cobro. Esta página se actualiza sola — no la cierres.';
  if (method === 'wompi_pse' || method === 'wompi_bancolombia_button') return 'Estamos conectando con tu banco. En unos segundos te llevamos a su portal — no cierres esta página.';
  return 'Esperando confirmación del banco… no cierres esta página.';
}

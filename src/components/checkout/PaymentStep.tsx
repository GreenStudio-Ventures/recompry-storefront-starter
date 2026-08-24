'use client';

// Cobro con Wompi de una orden creada con `wompi_cards`:
//   1. GET /api/payments/config → public_key + environment + tokens de aceptación.
//   2. Tokeniza la tarjeta en el browser (src/lib/wompi.ts — ver TODO allí).
//   3. POST /api/orders/{id}/payments { method:'card', token, installments, customer } con Idempotency-Key.
//   4. Si `final` es false (3DS), sondea GET /api/orders/{id}/payment hasta que lo sea.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Field, Notice, SectionTitle, Spinner } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { formatMoney } from '@/lib/format';
import type { Order, PaymentConfig, PaymentResult, PaymentStatus } from '@/lib/recompry/types';
import { tokenizeCardWithWompi } from '@/lib/wompi';
import { paymentPhone } from './phone';

type Props = {
  order: Order;
  customer: { email: string; full_name: string; phone: string };
  onPaid: () => void;
  onRestart: () => void;
};

export function PaymentStep({ order, customer, onPaid, onRestart }: Props) {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [card, setCard] = useState({ number: '', exp_month: '', exp_year: '', cvc: '', card_holder: customer.full_name });
  const [email, setEmail] = useState(customer.email);
  const [installments, setInstallments] = useState(1);
  const [accepted, setAccepted] = useState(false);
  const [paying, setPaying] = useState(false);
  const [result, setResult] = useState<PaymentResult | PaymentStatus | null>(null);
  const idem = useRef<string>(crypto.randomUUID());

  useEffect(() => {
    callApi<PaymentConfig>('/api/payments/config').then(setConfig).catch((err) => setError(toUiError(err)));
  }, []);

  // Sondeo mientras el pago no sea final (3DS, app del banco…).
  useEffect(() => {
    if (!result || result.final) return;
    const timer = setInterval(async () => {
      try {
        const status = await callApi<PaymentStatus>(`/api/orders/${order.id}/payment`);
        setResult(status);
        if (status.final) clearInterval(timer);
      } catch (err) {
        setError(toUiError(err));
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [result, order.id]);

  useEffect(() => {
    if (result?.status === 'approved') onPaid();
  }, [result?.status, onPaid]);

  async function pay(e: FormEvent) {
    e.preventDefault();
    if (!config?.public_key) return;
    setPaying(true);
    setError(null);
    try {
      const token = await tokenizeCardWithWompi(config.public_key, config.environment, card);
      const res = await callApi<PaymentResult>(`/api/orders/${order.id}/payments`, {
        body: {
          method: 'card',
          token,
          installments,
          // phone es opcional aquí y tiene minLength 7: un valor corto (p.ej. de un buyer viejo) tumba el cobro con 400.
          customer: { email: email.trim(), full_name: card.card_holder.trim(), phone: paymentPhone(customer.phone) },
          redirect_url: `${window.location.origin}/track/${order.tracking_code ?? order.id}`,
        },
        headers: { 'Idempotency-Key': idem.current },
      });
      setResult(res);
      if (res.async_payment_url) window.location.assign(res.async_payment_url);
    } catch (err) {
      setError(toUiError(err));
      idem.current = crypto.randomUUID(); // siguiente intento = nueva key
    } finally {
      setPaying(false);
    }
  }

  const declined = result && (result.status === 'declined' || result.status === 'error');

  return (
    <div className="mx-auto max-w-lg">
      <SectionTitle title="Pago con tarjeta" subtitle={`Pedido #${order.order_number ?? order.id.slice(0, 8)} · ${formatMoney(order.totals.grand_total, order.totals.currency_code)}`} />

      {!config && !error ? (
        <div className="flex justify-center py-12 text-slate-400"><Spinner className="h-8 w-8" /></div>
      ) : null}

      {config && !config.public_key ? (
        <Notice tone="warning">La tienda no tiene Wompi conectado ({'provider: null'}). Solo acepta contraentrega.</Notice>
      ) : null}

      {declined ? (
        <div className="space-y-4">
          <ErrorBanner title={result.decline?.title ?? 'Pago rechazado'} error={{ message: result.decline?.message ?? 'El banco rechazó la transacción.', code: result.decline?.category }} />
          <p className="text-sm text-slate-600">Un rechazo anula la orden; crea un pedido nuevo para intentar de nuevo.</p>
          <Button onClick={onRestart}>Volver al checkout</Button>
        </div>
      ) : result && !result.final ? (
        <Notice tone="info">
          <span className="inline-flex items-center gap-2"><Spinner className="h-4 w-4" /> Esperando confirmación del banco… no cierres esta página.</span>
        </Notice>
      ) : config?.public_key ? (
        <form onSubmit={pay} className="card space-y-4 p-5">
          {config.environment === 'sandbox' ? <Notice tone="warning">Ambiente sandbox: usa tarjetas de prueba de Wompi.</Notice> : null}
          <Field label="Número de tarjeta" htmlFor="card-number">
            <input id="card-number" className="input" inputMode="numeric" autoComplete="cc-number" required value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value })} placeholder="4242 4242 4242 4242" />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mes" htmlFor="card-mm"><input id="card-mm" className="input" required maxLength={2} placeholder="MM" value={card.exp_month} onChange={(e) => setCard({ ...card, exp_month: e.target.value })} /></Field>
            <Field label="Año" htmlFor="card-yy"><input id="card-yy" className="input" required maxLength={4} placeholder="AA" value={card.exp_year} onChange={(e) => setCard({ ...card, exp_year: e.target.value })} /></Field>
            <Field label="CVC" htmlFor="card-cvc"><input id="card-cvc" className="input" required maxLength={4} inputMode="numeric" value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} /></Field>
          </div>
          <Field label="Titular" htmlFor="card-holder"><input id="card-holder" className="input" required value={card.card_holder} onChange={(e) => setCard({ ...card, card_holder: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Correo del comprobante" htmlFor="card-email"><input id="card-email" type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
            <Field label="Cuotas" htmlFor="card-inst"><input id="card-inst" type="number" min={1} max={48} className="input" value={installments} onChange={(e) => setInstallments(Number(e.target.value) || 1)} /></Field>
          </div>
          {config.acceptance_tokens ? (
            <label className="flex items-start gap-2 text-xs text-slate-600">
              <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>
                Acepto el{' '}
                {config.acceptance_tokens.acceptance_permalink ? <a className="underline" href={config.acceptance_tokens.acceptance_permalink} target="_blank" rel="noreferrer">reglamento</a> : 'reglamento'}{' '}
                y la{' '}
                {config.acceptance_tokens.personal_data_auth_permalink ? <a className="underline" href={config.acceptance_tokens.personal_data_auth_permalink} target="_blank" rel="noreferrer">política de datos</a> : 'política de datos'}{' '}
                de Wompi.
              </span>
            </label>
          ) : null}
          <ErrorBanner error={error} />
          <Button type="submit" size="lg" className="w-full" loading={paying} disabled={config.acceptance_tokens ? !accepted : false}>
            Pagar {formatMoney(order.totals.grand_total, order.totals.currency_code)}
          </Button>
          <p className="text-center text-xs text-slate-400">El monto lo fija la tienda (grand_total de la orden); la tarjeta se tokeniza con la llave pública de Wompi.</p>
        </form>
      ) : (
        <ErrorBanner error={error} />
      )}
    </div>
  );
}

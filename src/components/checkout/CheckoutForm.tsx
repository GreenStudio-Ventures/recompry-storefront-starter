'use client';

// Checkout: entrega (modo/sede/dirección), contacto, pago y confirmación.
// `POST /api/orders` (route handler con la key secreta) crea la orden con `Idempotency-Key`;
// el servidor de Recompry re-cotiza todo. Con contraentrega termina en /track; con tarjeta
// pasa a <PaymentStep/> (Wompi).
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Field, LinkButton, Notice, SectionTitle, Spinner } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { useCart } from '@/lib/cart/CartProvider';
import { useCartQuote } from '@/lib/cart/useCartQuote';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import type { CreateOrderRequest, Order, OrderMode, PaymentMethodCode, ShippingQuote } from '@/lib/recompry/types';
import type { LocationOption } from '@/components/cart/CartView';
import { QuoteIssues, QuoteSummary } from '@/components/cart/QuoteSummary';
import { PaymentStep } from './PaymentStep';

type Props = {
  currency: string;
  modes: Array<{ mode: OrderMode; label: string }>;
  paymentMethods: Array<{ code: PaymentMethodCode; label: string }>;
  locations: LocationOption[];
  buyer: { name?: string | null; email?: string | null; phone?: string | null } | null;
  loggedIn: boolean;
};

export function CheckoutForm({ currency, modes, paymentMethods, locations, buyer, loggedIn }: Props) {
  const router = useRouter();
  const { state, hydrated, setContext, clear } = useCart();
  const { quote, loading: quoting, error: quoteError, request } = useCartQuote(state, hydrated);
  const { mode, location_id, address_text, table_number } = state.context;
  const needsAddress = mode === 'delivery' || mode === 'shipping';
  const needsLocation = mode === 'pickup' || mode === 'dine_in';

  const [name, setName] = useState(buyer?.name ?? '');
  const [phone, setPhone] = useState(buyer?.phone ?? '');
  const [email, setEmail] = useState(buyer?.email ?? '');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [instructions, setInstructions] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<PaymentMethodCode | undefined>(paymentMethods[0]?.code);
  const [shipping, setShipping] = useState<ShippingQuote | null>(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [order, setOrder] = useState<Order | null>(null);

  // Idempotency-Key: una por intento; si el body cambia, se genera otra (la misma key con
  // otro body responde 409 idempotency_key_conflict).
  const idem = useRef<{ key: string; body: string } | null>(null);

  useEffect(() => {
    if (hydrated && !state.lines.length && !order) router.replace('/cart');
  }, [hydrated, state.lines.length, order, router]);

  async function checkCoverage() {
    if (!address_text || address_text.trim().length < 3) return;
    setShippingLoading(true);
    setError(null);
    try {
      setShipping(await callApi<ShippingQuote>('/api/shipping/quote', { body: { address: { text: address_text.trim(), country: 'CO' } } }));
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setShippingLoading(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!request || !payment) return;
    setError(null);
    const body: CreateOrderRequest = {
      ...request,
      payment_method: payment,
      customer: { name: name.trim(), phone: phone.trim(), email: email.trim() || null },
      notes: notes.trim() || null,
      ...(needsAddress && address_text
        ? { shipping_address: { line1: address_text.trim(), line2: line2.trim() || null, city: city.trim() || null, country: 'CO', instructions: instructions.trim() || null } }
        : {}),
    };
    const bodyJson = JSON.stringify(body);
    if (!idem.current || idem.current.body !== bodyJson) idem.current = { key: crypto.randomUUID(), body: bodyJson };

    setSubmitting(true);
    try {
      const created = await callApi<Order>('/api/orders', { body, headers: { 'Idempotency-Key': idem.current.key } });
      setOrder(created);
      if (created.payment.method === 'cash_on_delivery' || created.payment.status === 'paid') {
        clear();
        router.push(`/track/${encodeURIComponent(created.tracking_code ?? created.id)}?nuevo=1`);
      }
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (order && order.payment.method !== 'cash_on_delivery' && order.payment.status !== 'paid') {
    return (
      <PaymentStep
        order={order}
        customer={{ email: email.trim(), full_name: name.trim(), phone: phone.trim() }}
        onPaid={() => {
          clear();
          router.push(`/track/${encodeURIComponent(order.tracking_code ?? order.id)}?nuevo=1&pago=aprobado`);
        }}
        onRestart={() => {
          idem.current = null;
          setOrder(null);
        }}
      />
    );
  }

  const blockingIssue = quote?.issues.find((i) => ['product_not_found', 'product_unavailable', 'out_of_stock', 'selection_required', 'invalid_selection', 'no_coverage', 'address_required', 'invalid_address', 'location_closed'].includes(i.code));
  const canSubmit = Boolean(quote && !quoting && !blockingIssue && name.trim() && phone.trim().length >= 5 && payment && (!needsAddress || (address_text ?? '').trim().length >= 3));

  return (
    <form onSubmit={submit}>
      <SectionTitle title="Checkout" action={<Link href="/cart" className="text-sm text-slate-500 hover:underline">Editar carrito</Link>} />
      {!loggedIn ? (
        <Notice tone="info" className="mb-6">
          ¿Ya tienes cuenta?{' '}
          <Link href="/account/login?next=/checkout" className="font-semibold underline">Inicia sesión</Link> para ver tus pedidos, direcciones y puntos.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* 1. Entrega */}
          <section className="card space-y-4 p-5">
            <h3 className="font-semibold">1. Entrega</h3>
            <div className="flex flex-wrap gap-2">
              {modes.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => {
                    setContext({ mode: m.mode });
                    setShipping(null);
                  }}
                  className={cn('rounded-xl border px-3 py-2 text-sm font-medium', mode === m.mode ? 'border-brand bg-brand text-brand-foreground' : 'border-slate-300 hover:bg-slate-50')}
                >
                  {m.label}
                </button>
              ))}
            </div>
            {needsLocation && locations.length ? (
              <Field label="Sede" htmlFor="co-location">
                <select id="co-location" className="input" value={location_id ?? ''} onChange={(e) => setContext({ location_id: e.target.value || undefined })}>
                  <option value="">Sede principal</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} · {l.status_text}</option>
                  ))}
                </select>
              </Field>
            ) : null}
            {mode === 'dine_in' ? (
              <Field label="Mesa" htmlFor="co-table">
                <input id="co-table" className="input" value={table_number ?? ''} onChange={(e) => setContext({ table_number: e.target.value || undefined })} />
              </Field>
            ) : null}
            {needsAddress ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Dirección" htmlFor="co-address">
                    <div className="flex gap-2">
                      <input id="co-address" className="input" required value={address_text ?? ''} onChange={(e) => { setContext({ address_text: e.target.value }); setShipping(null); }} placeholder="Calle 93 #11-27, Bogotá" />
                      <Button type="button" variant="secondary" loading={shippingLoading} onClick={checkCoverage}>Verificar</Button>
                    </div>
                  </Field>
                  {shipping ? (
                    <p className={cn('mt-2 text-sm', shipping.covered ? 'text-emerald-700' : 'text-red-700')}>
                      {shipping.covered
                        ? `Cobertura OK · ${shipping.location_name ?? 'tienda'} · envío ${shipping.shipping_amount === 0 ? 'gratis' : formatMoney(shipping.shipping_amount, shipping.currency_code)}${shipping.delivery_time_minutes ? ` · ~${shipping.delivery_time_minutes} min` : ''}${shipping.formatted_address ? ` · ${shipping.formatted_address}` : ''}`
                        : 'No hay cobertura para esa dirección. Prueba otra o elige recoger en tienda.'}
                    </p>
                  ) : null}
                </div>
                <Field label="Apto / torre / oficina" htmlFor="co-line2">
                  <input id="co-line2" className="input" value={line2} onChange={(e) => setLine2(e.target.value)} />
                </Field>
                <Field label="Ciudad" htmlFor="co-city">
                  <input id="co-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Indicaciones para el domiciliario" htmlFor="co-instr">
                    <input id="co-instr" className="input" maxLength={500} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
                  </Field>
                </div>
              </div>
            ) : null}
          </section>

          {/* 2. Contacto */}
          <section className="card space-y-4 p-5">
            <h3 className="font-semibold">2. Tus datos</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" htmlFor="co-name">
                <input id="co-name" className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
              </Field>
              <Field label="Teléfono" htmlFor="co-phone">
                <input id="co-phone" className="input" required minLength={5} maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+57 300 111 2233" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Correo (opcional)" htmlFor="co-email">
                  <input id="co-email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                </Field>
              </div>
            </div>
          </section>

          {/* 3. Pago */}
          <section className="card space-y-3 p-5">
            <h3 className="font-semibold">3. Pago</h3>
            {paymentMethods.length === 0 ? <Notice tone="warning">La tienda no tiene métodos de pago online habilitados.</Notice> : null}
            {paymentMethods.map((m) => (
              <label key={m.code} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-3 text-sm', payment === m.code ? 'border-brand bg-brand/5' : 'border-slate-200')}>
                <input type="radio" name="payment" value={m.code} checked={payment === m.code} onChange={() => setPayment(m.code)} className="accent-[var(--brand-primary)]" />
                <span className="font-medium">{m.label}</span>
              </label>
            ))}
            {payment && payment !== 'cash_on_delivery' ? <p className="text-xs text-slate-500">El cobro se hace en el siguiente paso, después de confirmar el pedido.</p> : null}
          </section>

          <section className="card space-y-3 p-5">
            <Field label="Notas para la tienda (opcional)" htmlFor="co-notes">
              <textarea id="co-notes" className="input" rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Tu pedido</h3>
            {quoting ? <Spinner className="h-4 w-4 text-slate-400" /> : null}
          </div>
          <ul className="space-y-1 text-sm text-slate-600">
            {state.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-2">
                <span className="truncate">{l.quantity}× {l.name}{l.variant_name ? ` (${l.variant_name})` : ''}</span>
              </li>
            ))}
          </ul>
          <ErrorBanner error={quoteError} />
          <QuoteSummary quote={quote} currency={currency} loading={quoting} />
          <QuoteIssues quote={quote} lineName={(id) => state.lines.find((l) => l.product_id === id)?.name} />
          <ErrorBanner error={error} title="No pudimos crear el pedido" />
          <Button type="submit" size="lg" className="w-full" disabled={!canSubmit} loading={submitting}>
            {payment === 'cash_on_delivery' ? 'Confirmar pedido' : 'Continuar al pago'}
          </Button>
          <LinkButton href="/cart" variant="ghost" size="sm" className="w-full">Volver al carrito</LinkButton>
        </aside>
      </div>
    </form>
  );
}

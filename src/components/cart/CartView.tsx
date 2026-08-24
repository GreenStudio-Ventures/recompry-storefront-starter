'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart/CartProvider';
import { useCartQuote } from '@/lib/cart/useCartQuote';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import type { OrderMode } from '@/lib/recompry/types';
import { Button, EmptyState, ErrorBanner, Field, LinkButton, SectionTitle, Spinner } from '@/components/ui';
import { matchQuotedLines } from './quoted-lines';
import { QuoteIssues, QuoteSummary } from './QuoteSummary';

export type LocationOption = {
  id: string;
  name: string;
  status_text: string;
  is_open: boolean;
  capabilities: { pickup: boolean; local_delivery: boolean; shipping: boolean };
};

export function CartView({ currency, modes, locations }: { currency: string; modes: Array<{ mode: OrderMode; label: string }>; locations: LocationOption[] }) {
  const { state, hydrated, setQuantity, removeLine, setContext, clear } = useCart();
  const { quote, loading, error } = useCartQuote(state, hydrated);
  const { mode, location_id, address_text, coupon_code, tip_amount, table_number } = state.context;
  const needsAddress = mode === 'delivery' || mode === 'shipping';
  const needsLocation = mode === 'pickup' || mode === 'dine_in';
  const lineName = (productId: string) => state.lines.find((l) => l.product_id === productId)?.name;
  // Alineación posicional (ver quoted-lines.ts): producto+variante+cantidad mezclaba líneas con distintos extras.
  const quotedByKey = matchQuotedLines(state.lines, quote);
  const blocking = quote?.issues.some((i) => ['product_not_found', 'product_unavailable', 'out_of_stock', 'selection_required', 'invalid_selection', 'no_coverage', 'address_required', 'invalid_address'].includes(i.code));

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24 text-slate-400">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!state.lines.length) {
    return <EmptyState title="Tu carrito está vacío" description="Explora el catálogo y agrega lo que quieras." action={<LinkButton href="/">Ver la tienda</LinkButton>} />;
  }

  return (
    <div>
      <SectionTitle title="Carrito" action={<Button variant="ghost" size="sm" onClick={clear}>Vaciar</Button>} />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <ul className="card divide-y divide-slate-100">
            {state.lines.map((line) => {
              const quoted = quotedByKey.get(line.key);
              const unit = quoted?.unit_price ?? line.unit_price_hint;
              return (
                <li key={line.key} className="flex gap-3 p-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                    {line.image ? <img src={line.image} alt="" className="h-full w-full object-cover" /> : <img src="/placeholder.svg" alt="" className="h-full w-full object-cover opacity-80" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/p/${encodeURIComponent(line.slug ?? line.product_id)}`} className="font-semibold hover:underline">
                      {line.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {[line.variant_name, ...line.modifier_names].filter(Boolean).join(' · ')}
                      {line.comment ? ` · “${line.comment}”` : ''}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="inline-flex h-8 items-center rounded-lg border border-slate-300">
                        <button type="button" className="px-2.5" onClick={() => setQuantity(line.key, line.quantity - 1)} aria-label="Menos">−</button>
                        <span className="w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                        <button type="button" className="px-2.5" onClick={() => setQuantity(line.key, line.quantity + 1)} aria-label="Más">+</button>
                      </div>
                      <button type="button" className="text-xs text-slate-500 hover:text-red-600" onClick={() => removeLine(line.key)}>
                        Quitar
                      </button>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold tabular-nums">{unit !== null ? formatMoney(unit * line.quantity, line.currency_code) : '—'}</p>
                    {unit !== null && line.quantity > 1 ? <p className="text-xs text-slate-400">{formatMoney(unit, line.currency_code)} c/u</p> : null}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="card space-y-4 p-5">
            <h3 className="font-semibold">¿Cómo quieres recibirlo?</h3>
            <div className="flex flex-wrap gap-2">
              {modes.map((m) => (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => setContext({ mode: m.mode })}
                  className={cn('rounded-xl border px-3 py-2 text-sm font-medium', mode === m.mode ? 'border-brand bg-brand text-brand-foreground' : 'border-slate-300 hover:bg-slate-50')}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {needsLocation && locations.length ? (
              <Field label="Sede" htmlFor="location">
                <select id="location" className="input" value={location_id ?? ''} onChange={(e) => setContext({ location_id: e.target.value || undefined })}>
                  <option value="">Sede principal</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} · {l.status_text}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {mode === 'dine_in' ? (
              <Field label="Mesa" htmlFor="table">
                <input id="table" className="input" value={table_number ?? ''} onChange={(e) => setContext({ table_number: e.target.value || undefined })} placeholder="Número de mesa" />
              </Field>
            ) : null}

            {needsAddress ? (
              <Field label="Dirección de entrega" htmlFor="address" hint="Incluye la ciudad. La tienda calcula la cobertura y el costo de envío.">
                <input id="address" className="input" value={address_text ?? ''} onChange={(e) => setContext({ address_text: e.target.value })} placeholder="Calle 93 #11-27, Bogotá" />
              </Field>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cupón" htmlFor="coupon">
                <input id="coupon" className="input uppercase" value={coupon_code ?? ''} onChange={(e) => setContext({ coupon_code: e.target.value.trim().toUpperCase() || undefined })} placeholder="CÓDIGO" />
              </Field>
              <Field label="Propina (opcional)" htmlFor="tip" hint="Máximo 30% del subtotal.">
                <input
                  id="tip"
                  type="number"
                  min={0}
                  step={500}
                  className="input"
                  value={tip_amount ?? ''}
                  onChange={(e) => setContext({ tip_amount: e.target.value ? Math.max(0, Number(e.target.value)) : undefined })}
                  placeholder="0"
                />
              </Field>
            </div>
          </div>
        </div>

        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Resumen</h3>
            {loading ? <Spinner className="h-4 w-4 text-slate-400" /> : null}
          </div>
          <ErrorBanner error={error} />
          <QuoteSummary quote={quote} currency={currency} loading={loading} />
          {quote?.shipping ? (
            <p className="text-xs text-slate-500">
              {quote.shipping.covered
                ? `Despacha ${quote.shipping.location_name ?? 'la tienda'}${quote.shipping.delivery_time_minutes ? ` · ~${quote.shipping.delivery_time_minutes} min` : ''}${quote.shipping.formatted_address ? ` · ${quote.shipping.formatted_address}` : ''}`
                : 'Sin cobertura para esa dirección: prueba otra o recoge en tienda.'}
            </p>
          ) : null}
          <QuoteIssues quote={quote} lineName={lineName} />
          <LinkButton href="/checkout" size="lg" className={cn('w-full', (!quote || blocking) && 'pointer-events-none opacity-50')}>
            Ir a pagar
          </LinkButton>
          <p className="text-center text-xs text-slate-400">Los totales los calcula la tienda; nada se cobra hasta confirmar.</p>
        </aside>
      </div>
    </div>
  );
}

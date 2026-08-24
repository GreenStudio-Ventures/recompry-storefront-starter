import { formatMoney } from '@/lib/format';
import type { CartQuote } from '@/lib/recompry/types';

/** Totales calculados por el servidor (`POST /v1/cart/quote`). */
export function QuoteSummary({ quote, currency, loading }: { quote: CartQuote | null; currency: string; loading?: boolean }) {
  const c = quote?.currency_code ?? currency;
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between ${strong ? 'text-base font-bold' : 'text-sm text-slate-600'}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className={`space-y-1.5 transition ${loading ? 'opacity-60' : ''}`}>
      {row('Subtotal', formatMoney(quote?.subtotal ?? 0, c))}
      {quote?.discounts_applied.map((d) => (
        <div key={d.id} className="flex justify-between text-sm text-emerald-700">
          <span>{d.name}{d.source === 'coupon' ? ' (cupón)' : ''}</span>
          <span className="tabular-nums">−{formatMoney(d.amount, c)}</span>
        </div>
      ))}
      {quote && quote.loyalty_discount > 0 ? row('Puntos canjeados', `−${formatMoney(quote.loyalty_discount, c)}`) : null}
      {quote && quote.credits_redeemed_cents > 0 ? row('Créditos', `−${formatMoney(quote.credits_redeemed_cents / 100, c)}`) : null}
      {quote && (quote.shipping_amount > 0 || quote.shipping) ? row('Envío', quote.shipping_amount === 0 ? 'Gratis' : formatMoney(quote.shipping_amount, c)) : null}
      {quote && quote.tip_amount > 0 ? row('Propina', formatMoney(quote.tip_amount, c)) : null}
      {quote && !quote.price_includes_taxes && quote.tax_iva_total > 0 ? row('IVA', formatMoney(quote.tax_iva_total, c)) : null}
      {quote && !quote.price_includes_taxes && quote.tax_inc_total > 0 ? row('Impoconsumo', formatMoney(quote.tax_inc_total, c)) : null}
      <div className="border-t border-slate-200 pt-2">{row('Total', formatMoney(quote?.grand_total ?? 0, c), true)}</div>
      {quote?.price_includes_taxes ? <p className="text-xs text-slate-400">Impuestos incluidos.</p> : null}
    </div>
  );
}

const ISSUE_TONE: Record<string, string> = {
  coupon_invalid: 'text-amber-700',
  tip_too_high: 'text-amber-700',
  location_closed: 'text-amber-700',
  buyer_required: 'text-slate-500',
  credits_not_available: 'text-slate-500',
  loyalty_not_available: 'text-slate-500',
};

export function QuoteIssues({ quote, lineName }: { quote: CartQuote | null; lineName?: (productId: string) => string | undefined }) {
  if (!quote?.issues.length) return null;
  return (
    <ul className="space-y-1 text-sm">
      {quote.issues.map((issue, i) => {
        const name = issue.product_id ? lineName?.(issue.product_id) : undefined;
        return (
          <li key={`${issue.code}-${i}`} className={ISSUE_TONE[issue.code] ?? 'text-red-700'}>
            {name ? <strong>{name}: </strong> : null}
            {issue.message}
          </li>
        );
      })}
    </ul>
  );
}

'use client';

// Selector de presentación (variantes), extras (modifier sets), cantidad y nota. Agrega al
// carrito local; el precio mostrado es una PISTA (variante + extras): el total real lo cotiza
// el servidor en /cart con POST /v1/cart/quote.
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Price } from '@/components/Price';
import { Button, Field } from '@/components/ui';
import { useCart } from '@/lib/cart/CartProvider';
import { cn } from '@/lib/cn';
import { formatMoney } from '@/lib/format';
import type { Product } from '@/lib/recompry/types';

export function PurchasePanel({ product }: { product: Product }) {
  const { addLine } = useCart();
  const variants = product.variants ?? [];
  const sets = (product.modifier_sets ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const [variantId, setVariantId] = useState<string | undefined>(() => (variants.find((v) => v.is_default && !v.sold_out) ?? variants.find((v) => !v.sold_out) ?? variants[0])?.id);
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');
  const [added, setAdded] = useState(false);

  const variant = variants.find((v) => v.id === variantId);
  const modifiersDelta = useMemo(
    () => sets.reduce((sum, set) => sum + (selections[set.id] ?? []).reduce((s, id) => s + (set.modifiers.find((m) => m.id === id)?.price_delta ?? 0), 0), 0),
    [sets, selections],
  );
  const basePrice = variant?.price ?? product.price;
  const unitPrice = basePrice === null ? null : basePrice + modifiersDelta;
  const compareAt = modifiersDelta === 0 ? (variant?.compare_at_price ?? product.compare_at_price) : null;

  const invalidSets = sets.filter((set) => {
    const n = (selections[set.id] ?? []).length;
    const min = set.require_selection ? Math.max(1, set.min_selections) : set.min_selections;
    return n < min || (set.max_selections !== null && n > set.max_selections);
  });
  const canAdd = product.is_available && (!variants.length || (variant && !variant.sold_out)) && invalidSets.length === 0;

  function toggle(setId: string, modifierId: string, max: number | null) {
    setSelections((prev) => {
      const current = prev[setId] ?? [];
      if (max === 1) return { ...prev, [setId]: current.includes(modifierId) ? [] : [modifierId] };
      if (current.includes(modifierId)) return { ...prev, [setId]: current.filter((id) => id !== modifierId) };
      if (max !== null && current.length >= max) return prev;
      return { ...prev, [setId]: [...current, modifierId] };
    });
  }

  function add() {
    const modifiers = sets
      .filter((set) => (selections[set.id] ?? []).length > 0)
      .map((set) => ({ modifier_set_id: set.id, modifier_ids: selections[set.id] ?? [] }));
    addLine({
      product_id: product.id,
      variant_id: variant?.id,
      quantity,
      modifiers,
      comment: comment.trim() || undefined,
      name: product.name,
      slug: product.slug,
      variant_name: variant?.name ?? null,
      modifier_names: modifiers.flatMap((m) => m.modifier_ids.map((id) => sets.find((s) => s.id === m.modifier_set_id)?.modifiers.find((x) => x.id === id)?.display_name ?? '')).filter(Boolean),
      unit_price_hint: unitPrice,
      image: product.image?.thumb ?? null,
      currency_code: product.currency_code,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 4000);
  }

  return (
    <div className="card space-y-5 p-5">
      <Price amount={unitPrice} compareAt={compareAt} currency={product.currency_code} size="lg" />

      {variants.length > 0 ? (
        <Field label="Presentación">
          <div className="grid gap-2 sm:grid-cols-2">
            {variants.map((v) => (
              <button
                key={v.id}
                type="button"
                disabled={v.sold_out}
                onClick={() => setVariantId(v.id)}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition disabled:opacity-40',
                  v.id === variantId ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-slate-200 hover:border-slate-300',
                )}
              >
                <span className="font-medium">{v.name ?? 'Estándar'}{v.sold_out ? ' · agotada' : ''}</span>
                <span className="tabular-nums text-slate-600">{formatMoney(v.price, product.currency_code)}</span>
              </button>
            ))}
          </div>
        </Field>
      ) : null}

      {sets.map((set) => {
        const chosen = selections[set.id] ?? [];
        const single = set.max_selections === 1;
        const min = set.require_selection ? Math.max(1, set.min_selections) : set.min_selections;
        return (
          <Field
            key={set.id}
            label={set.display_name ?? set.name}
            hint={[min > 0 ? `Elige al menos ${min}` : 'Opcional', set.max_selections !== null ? `máximo ${set.max_selections}` : null].filter(Boolean).join(' · ')}
          >
            <div className="space-y-1.5">
              {set.modifiers.map((m) => {
                const checked = chosen.includes(m.id);
                return (
                  <label key={m.id} className={cn('flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-sm', checked ? 'border-brand bg-brand/5' : 'border-slate-200')}>
                    <input type={single ? 'radio' : 'checkbox'} name={set.id} checked={checked} onChange={() => toggle(set.id, m.id, set.max_selections)} className="accent-[var(--brand-primary)]" />
                    <span className="flex-1">{m.display_name ?? m.name}</span>
                    {m.price_delta !== 0 ? (
                      <span className="tabular-nums text-slate-600">{m.price_delta > 0 ? '+' : ''}{formatMoney(m.price_delta, product.currency_code)}</span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </Field>
        );
      })}

      <Field label="Nota para la tienda" htmlFor="comment">
        <input id="comment" className="input" maxLength={500} placeholder="Ej: sin cebolla" value={comment} onChange={(e) => setComment(e.target.value)} />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex h-12 items-center rounded-xl border border-slate-300">
          <button type="button" className="h-full px-4 text-lg" onClick={() => setQuantity((q) => Math.max(1, q - 1))} aria-label="Menos">−</button>
          <span className="w-8 text-center text-sm font-semibold tabular-nums">{quantity}</span>
          <button type="button" className="h-full px-4 text-lg" onClick={() => setQuantity((q) => Math.min(999, q + 1))} aria-label="Más">+</button>
        </div>
        <Button size="lg" className="flex-1" disabled={!canAdd} onClick={add}>
          {added ? '¡Agregado!' : 'Agregar al carrito'}
        </Button>
      </div>
      {added ? (
        <p className="text-sm text-emerald-700">
          Listo. <Link href="/cart" className="font-semibold underline">Ver carrito</Link>
        </p>
      ) : null}
      {invalidSets.length ? <p className="text-xs text-amber-700">Completa: {invalidSets.map((s) => s.display_name ?? s.name).join(', ')}.</p> : null}
    </div>
  );
}

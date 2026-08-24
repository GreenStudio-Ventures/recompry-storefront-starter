'use client';

// Planes de suscripción que aplican al producto (GET /v1/products/{slug}?include=subscription_plans).
// La suscripción es un flujo SEPARADO del carrito: exige comprador autenticado y crea el
// contrato con POST /v1/subscriptions (el primer ciclo queda pendiente de pago).
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorBanner, Notice } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { cn } from '@/lib/cn';
import { formatInterval, formatMoney } from '@/lib/format';
import type { ProductSubscriptionPlan, Subscription } from '@/lib/recompry/types';

export function SubscriptionPlans({ productId, plans, currency }: { productId: string; plans: ProductSubscriptionPlan[]; currency: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [choice, setChoice] = useState<{ plan: string; frequency: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [created, setCreated] = useState<(Subscription & { deduped?: boolean }) | null>(null);

  async function subscribe() {
    if (!choice) return;
    const plan = plans.find((p) => p.id === choice.plan);
    setLoading(true);
    setError(null);
    try {
      const sub = await callApi<Subscription & { deduped?: boolean }>('/api/subscriptions', {
        body: {
          plan_id: choice.plan,
          frequency_option_id: choice.frequency,
          ...(plan?.plan_type === 'benefit_membership' ? {} : { items: [{ product_id: productId, quantity: 1 }] }),
        },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setCreated(sub);
    } catch (err) {
      const ui = toUiError(err);
      if (ui.code === 'buyer_token_required') {
        router.push(`/account/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      setError(ui);
    } finally {
      setLoading(false);
    }
  }

  if (created) {
    // `deduped`: el API devolvió el contrato vivo que ya existía; decir «creada» engaña al comprador.
    return created.deduped ? (
      <Notice tone="info">
        Ya tenías esta suscripción activa (estado: {created.status}); no se creó otra. Gestiónala en{' '}
        <a href="/account#suscripciones" className="font-semibold underline">tu cuenta</a>.
      </Notice>
    ) : (
      <Notice tone="success">
        Suscripción creada (estado: {created.status}). Revisa el primer ciclo en{' '}
        <a href="/account#suscripciones" className="font-semibold underline">tu cuenta</a>.
      </Notice>
    );
  }

  return (
    <section className="card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Suscríbete y recíbelo periódicamente</h2>
      <div className="mt-3 space-y-3">
        {plans.map((plan) => (
          <div key={plan.id}>
            <p className="font-semibold">{plan.name}</p>
            {plan.description ? <p className="text-sm text-slate-500">{plan.description}</p> : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {plan.frequencies.map((f) => {
                const selected = choice?.plan === plan.id && choice.frequency === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setChoice({ plan: plan.id, frequency: f.id })}
                    className={cn('rounded-xl border px-3 py-2 text-left text-sm', selected ? 'border-brand bg-brand/5 ring-2 ring-brand/20' : 'border-slate-200 hover:border-slate-300')}
                  >
                    <span className="block font-medium">{f.label}</span>
                    <span className="block text-slate-600">
                      {formatMoney(f.price, f.currency_code || currency)} {formatInterval(f.interval_unit, f.interval_count)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <ErrorBanner error={error} className="mt-3" />
      <Button className="mt-4 w-full" variant="secondary" disabled={!choice} loading={loading} onClick={subscribe}>
        Suscribirme
      </Button>
      <p className="mt-2 text-xs text-slate-400">Requiere iniciar sesión. El precio de cada ciclo lo calcula la tienda con el catálogo vigente.</p>
    </section>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AddressManager } from '@/components/account/AddressManager';
import { LogoutButton } from '@/components/account/LogoutButton';
import { SessionRefresher } from '@/components/account/SessionRefresher';
import { SubscriptionActions } from '@/components/account/SubscriptionActions';
import { WaitlistList } from '@/components/account/WaitlistList';
import { Badge, SectionTitle } from '@/components/ui';
import { formatDate, formatInterval, formatMoney } from '@/lib/format';
import { RecompryApiError, isApiError } from '@/lib/recompry/errors';
import { serverApi } from '@/lib/recompry/server';
import { getBuyerSession } from '@/lib/recompry/session';
import type { Address, Credits, Customer, LoyaltyBalance, Order, Subscription, WaitlistEntry } from '@/lib/recompry/types';

export const metadata: Metadata = { title: 'Mi cuenta' };

type Settled<T> = { ok: true; value: T } | { ok: false; error: RecompryApiError };

/** Cada sección se carga por separado: un scope faltante o una ficha inexistente no tumba la página. */
async function settle<T>(p: Promise<{ data?: { data: T }; error?: unknown; response: Response }>): Promise<Settled<T>> {
  try {
    const r = await p;
    if (r.data) return { ok: true, value: r.data.data };
    throw new RecompryApiError(r.response.status, (r.error ?? null) as Partial<import('@/lib/recompry/types').ErrorResponse> | null);
  } catch (err) {
    return { ok: false, error: isApiError(err) ? err : new RecompryApiError(0, { code: 'network_error', error: (err as Error).message }) };
  }
}

function Unavailable({ error, what }: { error: RecompryApiError; what: string }) {
  const friendly =
    error.code === 'customer_not_found'
      ? 'Aún no tienes ficha en esta tienda (con keys de test no se crea).'
      : error.code === 'insufficient_scope' || error.status === 403
        ? `La API key del sitio no tiene permiso para ${what}.`
        : error.message;
  return (
    <p className="text-sm text-slate-500">
      {friendly} <span className="font-mono text-xs text-slate-400">{error.code}</span>
    </p>
  );
}

const STAGE_TONE: Record<string, 'neutral' | 'info' | 'success' | 'danger' | 'warning'> = {
  received: 'info',
  preparing: 'warning',
  ready: 'info',
  on_the_way: 'info',
  delivered: 'success',
  canceled: 'danger',
};

export default async function AccountPage() {
  const { session, refreshed } = await getBuyerSession();
  if (!session) redirect('/account/login?next=/account');
  if (refreshed) return <SessionRefresher next="/account" />;

  const api = serverApi(session.access_token);
  const [me, addresses, orders, subscriptions, loyalty, credits, waitlist] = await Promise.all([
    settle<Customer>(api.GET('/v1/customers/me')),
    settle<Address[]>(api.GET('/v1/customers/me/addresses')),
    settle<Order[]>(api.GET('/v1/orders', { params: { query: { customer: 'me', limit: 20 } } })),
    settle<Subscription[]>(api.GET('/v1/subscriptions', { params: { query: { customer: 'me', limit: 20 } } })),
    settle<LoyaltyBalance>(api.GET('/v1/loyalty/balance')),
    settle<Credits>(api.GET('/v1/credits')),
    settle<WaitlistEntry[]>(api.GET('/v1/waitlist')),
  ]);

  const displayName = me.ok ? me.value.name : (session.user.email ?? session.user.phone ?? 'comprador');

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionTitle title={`Hola, ${displayName}`} subtitle={[session.user.email, session.user.phone].filter(Boolean).join(' · ')} action={<LogoutButton />} />

      <nav className="flex flex-wrap gap-2 text-sm">
        {['pedidos', 'direcciones', 'suscripciones', 'puntos', 'lista-de-espera'].map((s) => (
          <a key={s} href={`#${s}`} className="rounded-lg bg-white px-3 py-1.5 capitalize text-slate-600 shadow-sm hover:text-slate-900">{s.replace(/-/g, ' ')}</a>
        ))}
      </nav>

      {/* Puntos y créditos */}
      {(loyalty.ok && loyalty.value.program_active) || (credits.ok && credits.value.program_active) ? (
        <section id="puntos" className="grid gap-4 sm:grid-cols-2">
          {loyalty.ok && loyalty.value.program_active ? (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Puntos</p>
              <p className="mt-1 text-3xl font-black">{loyalty.value.points}</p>
              <p className="text-sm text-slate-500">
                {loyalty.value.level ? `Nivel ${loyalty.value.level.name} · ` : ''}
                {loyalty.value.redeem_value_per_point > 0 ? `1 punto = ${formatMoney(loyalty.value.redeem_value_per_point, loyalty.value.currency_code)} (mín. ${loyalty.value.redeem_min_points})` : 'Acumula puntos con tus compras'}
              </p>
              {loyalty.value.movements.length ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-500">
                  {loyalty.value.movements.slice(0, 5).map((m) => (
                    <li key={m.id} className="flex justify-between"><span>{m.reason ?? m.type}</span><span className={m.points > 0 ? 'text-emerald-600' : 'text-red-600'}>{m.points > 0 ? '+' : ''}{m.points}</span></li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          {credits.ok && credits.value.program_active ? (
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Créditos por referidos</p>
              <p className="mt-1 text-3xl font-black">{formatMoney(credits.value.balance_cents / 100, credits.value.currency_code)}</p>
              {credits.value.referral_code ? <p className="text-sm text-slate-500">Tu código: <span className="font-mono font-semibold">{credits.value.referral_code}</span></p> : null}
            </div>
          ) : null}
        </section>
      ) : (
        <section id="puntos" className="card p-5">
          <h3 className="font-semibold">Puntos</h3>
          {loyalty.ok ? <p className="text-sm text-slate-500">La tienda no tiene programa de puntos activo.</p> : <Unavailable error={loyalty.error} what="leer puntos (loyalty:read)" />}
        </section>
      )}

      {/* Pedidos */}
      <section id="pedidos" className="card p-5">
        <h3 className="font-semibold">Mis pedidos</h3>
        {!orders.ok ? (
          <Unavailable error={orders.error} what="leer pedidos (orders:read)" />
        ) : orders.value.length === 0 ? (
          <p className="text-sm text-slate-500">Todavía no has hecho pedidos. <Link href="/" className="underline">Ver la tienda</Link></p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {orders.value.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    Pedido #{o.order_number ?? o.id.slice(0, 8)} <Badge tone={STAGE_TONE[o.stage] ?? 'neutral'} className="ml-1">{o.stage}</Badge>
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(o.created_at)} · {o.items.length} {o.items.length === 1 ? 'producto' : 'productos'} · {o.payment.method} ({o.payment.status})</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{formatMoney(o.totals.grand_total, o.totals.currency_code)}</p>
                  {o.tracking_code ? <Link href={`/track/${o.tracking_code}`} className="text-xs text-slate-500 hover:underline">Seguir</Link> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Direcciones */}
      <section id="direcciones" className="card p-5">
        <h3 className="mb-2 font-semibold">Direcciones</h3>
        {addresses.ok ? <AddressManager addresses={addresses.value} /> : <Unavailable error={addresses.error} what="leer direcciones (customers:read)" />}
      </section>

      {/* Suscripciones */}
      <section id="suscripciones" className="card p-5">
        <h3 className="font-semibold">Suscripciones</h3>
        {!subscriptions.ok ? (
          <Unavailable error={subscriptions.error} what="leer suscripciones (subscriptions:read)" />
        ) : subscriptions.value.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes suscripciones.</p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-100">
            {subscriptions.value.map((s) => (
              <li key={s.id} className="py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.plan.name ?? 'Plan'} <Badge className="ml-1" tone={s.status === 'active' ? 'success' : s.status === 'paused' ? 'warning' : s.status === 'canceled' ? 'danger' : 'neutral'}>{s.status}</Badge></p>
                    <p className="text-xs text-slate-500">
                      {s.frequency.label} ({formatInterval(s.frequency.interval_unit, s.frequency.interval_count)}) · {formatMoney(s.total_amount, s.currency_code)} por ciclo
                      {s.next_billing_at ? ` · próximo cobro ${formatDate(s.next_billing_at, { dateStyle: 'medium', timeStyle: undefined })}` : ''}
                    </p>
                    {s.items.length ? <p className="text-xs text-slate-400">{s.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</p> : null}
                  </div>
                </div>
                <SubscriptionActions id={s.id} status={s.status} pauseAllowed={s.frequency.pause_allowed} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Lista de espera */}
      <section id="lista-de-espera" className="card p-5">
        <h3 className="mb-2 font-semibold">Lista de espera</h3>
        {waitlist.ok ? <WaitlistList entries={waitlist.value} /> : <Unavailable error={waitlist.error} what="leer la lista de espera" />}
      </section>
    </div>
  );
}

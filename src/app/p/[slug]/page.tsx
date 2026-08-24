import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AvailabilityBadge } from '@/components/ProductCard';
import { Gallery } from '@/components/product/Gallery';
import { PurchasePanel } from '@/components/product/PurchasePanel';
import { SubscriptionPlans } from '@/components/product/SubscriptionPlans';
import { WaitlistForm } from '@/components/product/WaitlistForm';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { isApiError } from '@/lib/recompry/errors';
import type { Product } from '@/lib/recompry/types';
import { getProduct, getStore } from '@/lib/store';

type Props = { params: Promise<{ slug: string }> };

async function loadProduct(slug: string): Promise<Product> {
  try {
    return await getProduct(slug);
  } catch (err) {
    if (isApiError(err) && err.status === 404) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await loadProduct(slug);
  return {
    title: product.name,
    description: product.description?.slice(0, 160) ?? undefined,
    openGraph: product.image ? { images: [{ url: product.image.lg }] } : undefined,
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [store, product] = await Promise.all([getStore(), loadProduct(slug)]);
  const category = product.category_ids.map((id) => store.categories.find((c) => c.id === id)).find(Boolean);
  const features = Object.entries(product.features ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== '');
  const plans = product.subscription_plans ?? [];

  return (
    <div>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:underline">Inicio</Link>
        {category ? (
          <>
            <span className="mx-1">/</span>
            <Link href={`/c/${encodeURIComponent(category.slug ?? category.id)}`} className="hover:underline">{category.name}</Link>
          </>
        ) : null}
        <span className="mx-1">/</span>
        <span className="text-slate-900">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={product.images} fallback={product.image} name={product.name} />

        <div className="space-y-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <AvailabilityBadge p={product} />
              {product.discount_percent > 0 ? <Badge tone="brand">-{Math.round(product.discount_percent)}%</Badge> : null}
              {product.item_type === 'service' ? <Badge>Servicio</Badge> : null}
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{product.name}</h1>
            {product.is_waitlist_enabled && product.launch_date ? (
              <p className="mt-1 text-sm text-slate-500">Lanzamiento: {formatDate(product.launch_date, { dateStyle: 'long', timeStyle: undefined })}</p>
            ) : null}
          </div>

          {product.is_available ? (
            <PurchasePanel product={product} />
          ) : product.is_waitlist_enabled ? (
            <WaitlistForm productId={product.id} productName={product.name} />
          ) : (
            <div className="card p-4 text-sm text-slate-600">Este producto no está disponible por ahora.</div>
          )}

          {product.description ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Descripción</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">{product.description}</p>
            </section>
          ) : null}

          {features.length ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Características</h2>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {features.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="capitalize text-slate-500">{k.replace(/_/g, ' ')}</dt>
                    <dd className="text-slate-800">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          {product.pharma ? (
            <section className="card p-4 text-sm">
              <h2 className="font-semibold">Información farmacéutica</h2>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-slate-600">{JSON.stringify(product.pharma, null, 2)}</pre>
            </section>
          ) : null}

          <p className="text-xs text-slate-400">
            {product.tax.price_includes_taxes === false ? 'Precio antes de impuestos; ' : 'Impuestos incluidos; '}
            {product.tax.iva_rate ? `IVA ${product.tax.iva_rate}%` : 'sin IVA'}
            {product.tax.inc_rate ? ` · INC ${product.tax.inc_rate}%` : ''}.
          </p>

          {plans.length ? <SubscriptionPlans productId={product.id} plans={plans} currency={product.currency_code} /> : null}
        </div>
      </div>
    </div>
  );
}

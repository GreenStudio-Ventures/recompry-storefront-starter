import Link from 'next/link';
import { ApiImage } from './ApiImage';
import { Price } from './Price';
import { Badge } from './ui';
import type { ImageSet } from '@/lib/recompry/types';

/** Shape mínimo común entre `Product` (catálogo) y `SearchProduct` (búsqueda). */
export type ProductCardData = {
  id: string;
  slug: string | null;
  name: string;
  price: number | null;
  compare_at_price: number | null;
  discount_percent?: number | null;
  currency_code: string;
  image: ImageSet | null;
  availability?: string;
  is_available?: boolean;
  is_waitlist_enabled?: boolean;
  is_trending?: boolean;
};

export function productHref(p: Pick<ProductCardData, 'id' | 'slug'>) {
  return `/p/${encodeURIComponent(p.slug ?? p.id)}`;
}

export function AvailabilityBadge({ p }: { p: ProductCardData }) {
  if (p.is_waitlist_enabled && p.is_available === false) return <Badge tone="info">Próximamente</Badge>;
  if (p.is_available === false || p.availability === 'out_of_stock') return <Badge tone="danger">Agotado</Badge>;
  if (p.availability === 'low_stock') return <Badge tone="warning">Pocas unidades</Badge>;
  return null;
}

export function ProductCard({ product, priority = false }: { product: ProductCardData; priority?: boolean }) {
  const discount = product.discount_percent ?? 0;
  return (
    <Link href={productHref(product)} className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <ApiImage image={product.image} alt={product.name} priority={priority} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {discount > 0 ? <Badge tone="brand">-{Math.round(discount)}%</Badge> : null}
          {product.is_trending ? <Badge tone="warning">Popular</Badge> : null}
        </div>
        <div className="absolute bottom-2 left-2">
          <AvailabilityBadge p={product} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</h3>
        <div className="mt-auto pt-1">
          <Price amount={product.price} compareAt={product.compare_at_price} currency={product.currency_code} size="sm" />
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ products, priorityCount = 4 }: { products: ProductCardData[]; priorityCount?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p, i) => (
        <ProductCard key={p.id} product={p} priority={i < priorityCount} />
      ))}
    </div>
  );
}

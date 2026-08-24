import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGrid } from '@/components/ProductCard';
import { EmptyState, LinkButton, SectionTitle } from '@/components/ui';
import { isApiError } from '@/lib/recompry/errors';
import { getCategories, getStore, listProducts } from '@/lib/store';

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ cursor?: string }> };

async function findCategory(slug: string) {
  const store = await getStore();
  const fromStore = store.categories.find((c) => c.slug === slug || c.id === slug);
  if (fromStore) return fromStore;
  const all = await getCategories().catch(() => []);
  return all.find((c) => c.slug === slug || c.id === slug) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);
  return { title: category?.name ?? 'Categoría' };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { cursor } = await searchParams;
  const category = await findCategory(slug);

  let page;
  try {
    page = await listProducts({ category: slug, cursor, limit: 24 });
  } catch (err) {
    if (isApiError(err) && err.status === 404) notFound();
    throw err;
  }

  return (
    <div>
      <nav className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:underline">Inicio</Link> <span className="mx-1">/</span> <span className="text-slate-900">{category?.name ?? slug}</span>
      </nav>
      <SectionTitle title={category?.name ?? 'Categoría'} subtitle={cursor ? 'Siguiente página' : undefined} />
      {page.items.length ? (
        <ProductGrid products={page.items} />
      ) : (
        <EmptyState title="Nada por aquí todavía" description="Esta categoría no tiene productos publicados." action={<LinkButton href="/">Ver la tienda</LinkButton>} />
      )}
      {page.nextCursor ? (
        <div className="mt-8 flex justify-center">
          <LinkButton href={`/c/${encodeURIComponent(slug)}?cursor=${encodeURIComponent(page.nextCursor)}`} variant="secondary">
            Ver más productos
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

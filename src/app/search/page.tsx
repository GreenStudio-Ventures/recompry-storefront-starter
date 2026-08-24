import type { Metadata } from 'next';
import { ProductGrid } from '@/components/ProductCard';
import { SearchForm } from '@/components/SearchForm';
import { EmptyState, LinkButton, SectionTitle } from '@/components/ui';
import { publicApi } from '@/lib/recompry/client';
import { unwrap } from '@/lib/recompry/errors';

type Props = { searchParams: Promise<{ q?: string; cursor?: string }> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `Buscar “${q}”` : 'Buscar' };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q = '', cursor } = await searchParams;
  const term = q.trim();

  if (!term) {
    return (
      <div className="mx-auto max-w-xl">
        <SectionTitle title="Buscar" subtitle="Busca por nombre, descripción o principio activo." />
        <SearchForm />
      </div>
    );
  }

  // GET /v1/search: relevancia, tolerante a acentos y errores de tipeo, disponibles primero.
  const result = unwrap(await publicApi().GET('/v1/search', { params: { query: { q: term, limit: 24, ...(cursor ? { cursor } : {}) } } }));

  return (
    <div>
      <SearchForm defaultValue={term} className="mb-6 max-w-xl" />
      <SectionTitle title={`Resultados para “${term}”`} />
      {result.data.length ? (
        <ProductGrid products={result.data} />
      ) : (
        <EmptyState title="Sin resultados" description="Prueba con otra palabra o revisa la ortografía." action={<LinkButton href="/">Ver la tienda</LinkButton>} />
      )}
      {result.meta.next_cursor ? (
        <div className="mt-8 flex justify-center">
          <LinkButton href={`/search?q=${encodeURIComponent(term)}&cursor=${encodeURIComponent(result.meta.next_cursor)}`} variant="secondary">
            Ver más resultados
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

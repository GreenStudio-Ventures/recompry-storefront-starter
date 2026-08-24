import Link from 'next/link';
import { ApiImage } from '@/components/ApiImage';
import { ProductGrid } from '@/components/ProductCard';
import { Badge, LinkButton, SectionTitle } from '@/components/ui';
import { storeTitle } from '@/lib/brand';
import { enabledModes, getCategories, getLocations, getStore, listProducts } from '@/lib/store';

export default async function HomePage() {
  const store = await getStore();
  const [featured, locations, fallbackCategories] = await Promise.all([
    listProducts({ limit: 12, sort: '-created_at' }),
    getLocations().catch(() => []),
    store.categories.length ? Promise.resolve([]) : getCategories().catch(() => []),
  ]);
  const categories = store.categories.length ? store.categories : fallbackCategories.filter((c) => !c.parent_id);
  const products = [...featured.items].sort((a, b) => Number(b.is_trending) - Number(a.is_trending));
  const modes = enabledModes(store);
  const banner = store.branding.banner;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand text-brand-foreground">
        {banner ? (
          <>
            <ApiImage image={banner} alt="" priority sizes="100vw" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" />
          </>
        ) : null}
        <div className={`relative px-6 py-14 sm:px-10 sm:py-20 ${banner ? 'text-white' : ''}`}>
          <div className="flex flex-wrap gap-2">
            {modes.map((m) => (
              <Badge key={m.mode} tone="neutral" className="bg-white/15 text-inherit backdrop-blur">
                {m.label}
              </Badge>
            ))}
          </div>
          <h1 className="mt-4 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl">{storeTitle(store)}</h1>
          {store.branding.description ? <p className="mt-3 max-w-xl text-base opacity-90 sm:text-lg">{store.branding.description}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#catalogo" className="inline-flex h-12 items-center rounded-xl bg-white px-6 text-base font-semibold text-slate-900 shadow hover:bg-slate-100">
              Ver catálogo
            </a>
            {store.contact.whatsapp ? (
              <a
                href={`https://wa.me/${store.contact.whatsapp.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-12 items-center rounded-xl border border-white/40 px-6 text-base font-semibold hover:bg-white/10"
              >
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </section>

      {/* Categorías */}
      {categories.length > 0 ? (
        <section>
          <SectionTitle title="Categorías" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {categories.map((c) => (
              <Link key={c.id} href={`/c/${encodeURIComponent(c.slug ?? c.id)}`} className="card group relative aspect-[4/3] overflow-hidden">
                {c.image ? (
                  <ApiImage image={c.image} alt="" sizes="(min-width: 1024px) 16vw, 50vw" className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/90 to-brand-secondary text-3xl font-black text-brand-foreground">
                    {c.name.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pb-2.5 pt-8 text-sm font-semibold text-white">{c.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Destacados */}
      <section id="catalogo">
        <SectionTitle
          title="Destacados"
          subtitle={products.length ? undefined : 'Aún no hay productos publicados.'}
          action={featured.nextCursor ? <LinkButton href="/search?q=" variant="ghost" size="sm">Buscar</LinkButton> : undefined}
        />
        {products.length ? <ProductGrid products={products} /> : null}
      </section>

      {/* Sedes */}
      {locations.length > 0 ? (
        <section>
          <SectionTitle title="Sedes" subtitle="Horarios en la zona horaria de cada sede." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((l) => (
              <div key={l.id} className="card flex gap-3 p-4">
                {l.image ? <img src={l.image.thumb} alt="" className="h-16 w-16 rounded-xl object-cover" /> : null}
                <div className="min-w-0">
                  <p className="font-semibold">{l.name}</p>
                  <p className="truncate text-sm text-slate-500">{[l.address_line1, l.city].filter(Boolean).join(', ') || 'Sin dirección'}</p>
                  <p className={`mt-1 text-xs font-semibold ${l.is_open ? 'text-emerald-600' : 'text-slate-400'}`}>{l.status_text}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {l.capabilities.pickup ? <Badge>Recogida</Badge> : null}
                    {l.capabilities.local_delivery ? <Badge>Domicilio</Badge> : null}
                    {l.capabilities.shipping ? <Badge>Envío nacional</Badge> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

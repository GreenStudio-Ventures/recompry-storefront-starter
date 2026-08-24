import Link from 'next/link';
import type { Store } from '@/lib/recompry/types';
import { CartButton } from './CartButton';
import { SearchForm } from './SearchForm';

function categoryHref(c: { id: string; slug: string | null }) {
  return `/c/${encodeURIComponent(c.slug ?? c.id)}`;
}

export function Header({ store }: { store: Store }) {
  const logo = store.branding.logo;
  const categories = store.categories.slice(0, 8);
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="container-x flex h-16 items-center gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          {logo ? (
            <img src={logo.thumb} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-foreground">
              {store.name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span className="truncate text-base font-bold tracking-tight">{store.name}</span>
        </Link>

        <SearchForm className="ml-auto hidden w-full max-w-xs md:block" />

        <nav className="ml-auto flex items-center gap-2 md:ml-0">
          <Link href="/track" className="hidden h-10 items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex">
            Rastrear
          </Link>
          <Link href="/account" className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100" aria-label="Mi cuenta">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path strokeLinecap="round" d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            <span className="hidden sm:inline">Cuenta</span>
          </Link>
          <CartButton />
        </nav>
      </div>
      {categories.length > 0 ? (
        <div className="border-t border-slate-100">
          <div className="container-x scrollbar-none flex gap-1 overflow-x-auto py-1.5">
            {categories.map((c) => (
              <Link key={c.id} href={categoryHref(c)} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
      <div className="container-x pb-2 md:hidden">
        <SearchForm />
      </div>
    </header>
  );
}

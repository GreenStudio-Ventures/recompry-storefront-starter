'use client';

import Link from 'next/link';
import { useCart } from '@/lib/cart/CartProvider';

export function CartButton() {
  const { count, hydrated } = useCart();
  return (
    <Link
      href="/cart"
      className="relative inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold hover:bg-slate-50"
      aria-label={`Carrito, ${count} productos`}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 4h14M10 21a1 1 0 100-2 1 1 0 000 2zm7 0a1 1 0 100-2 1 1 0 000 2z" />
      </svg>
      <span className="hidden sm:inline">Carrito</span>
      {hydrated && count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[11px] font-bold text-brand-foreground">
          {count}
        </span>
      ) : null}
    </Link>
  );
}

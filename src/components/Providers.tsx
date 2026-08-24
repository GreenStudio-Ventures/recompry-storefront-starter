'use client';

import type { ReactNode } from 'react';
import { CartProvider } from '@/lib/cart/CartProvider';
import type { OrderMode } from '@/lib/recompry/types';

export function Providers({ children, defaultMode }: { children: ReactNode; defaultMode: OrderMode }) {
  return <CartProvider defaultMode={defaultMode}>{children}</CartProvider>;
}

'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Vuelve a renderizar la página del servidor cada N segundos mientras el pedido siga vivo. */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

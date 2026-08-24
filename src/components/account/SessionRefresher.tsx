'use client';

// El server component detectó el access_token vencido: un route handler sí puede renovar y
// reescribir la cookie; luego volvemos a renderizar. Si no se puede renovar, al login.
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui';
import { callApi } from '@/lib/browser-api';

export function SessionRefresher({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    callApi<{ authenticated: boolean }>('/api/auth/refresh', { method: 'POST', body: {} })
      .then((r) => (r.authenticated ? router.refresh() : router.replace(`/account/login?next=${encodeURIComponent(next)}`)))
      .catch(() => router.replace(`/account/login?next=${encodeURIComponent(next)}`));
  }, [router, next]);
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
      <Spinner className="h-6 w-6" /> Renovando sesión…
    </div>
  );
}

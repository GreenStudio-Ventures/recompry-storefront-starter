'use client';

import { Button } from '@/components/ui';

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-xl font-bold">Algo salió mal</h1>
      <p className="mt-2 text-sm text-slate-600">{error.message || 'Error inesperado.'}</p>
      {error.digest ? <p className="mt-1 font-mono text-xs text-slate-400">{error.digest}</p> : null}
      <Button className="mt-6" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}

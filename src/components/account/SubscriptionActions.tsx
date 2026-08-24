'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, ErrorBanner } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';

export function SubscriptionActions({ id, status, pauseAllowed }: { id: string; status: string; pauseAllowed: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<UiError | null>(null);

  async function run(action: 'pause' | 'resume' | 'cancel') {
    if (action === 'cancel' && !confirm('¿Cancelar la suscripción? No se cobrarán más ciclos.')) return;
    setLoading(action);
    setError(null);
    try {
      await callApi(`/api/subscriptions/${id}`, { body: { action } });
      router.refresh();
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setLoading(null);
    }
  }

  const alive = status === 'active' || status === 'paused' || status === 'past_due';
  if (!alive) return null;
  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === 'paused' ? (
          <Button size="sm" variant="secondary" loading={loading === 'resume'} onClick={() => run('resume')}>Reanudar</Button>
        ) : pauseAllowed ? (
          <Button size="sm" variant="secondary" loading={loading === 'pause'} onClick={() => run('pause')}>Pausar</Button>
        ) : null}
        <Button size="sm" variant="danger" loading={loading === 'cancel'} onClick={() => run('cancel')}>Cancelar</Button>
      </div>
      <ErrorBanner error={error} />
    </div>
  );
}

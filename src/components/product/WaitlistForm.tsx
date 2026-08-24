'use client';

import { useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Notice } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import type { WaitlistEntry } from '@/lib/recompry/types';

// Pre-lanzamiento: el comprador se anota y la tienda le avisa. Con sesión iniciada el correo
// se ignora (usa la identidad de la cuenta); como invitado es obligatorio.
export function WaitlistForm({ productId, productName }: { productId: string; productName: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);
  const [done, setDone] = useState<WaitlistEntry | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      setDone(await callApi<WaitlistEntry>('/api/waitlist', { body: { product_id: productId, email: email || undefined } }));
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <Notice tone="success">
        Te avisaremos cuando <strong>{productName}</strong> esté disponible. Estado: {done.status}.
      </Notice>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-3 p-5">
      <p className="text-sm font-semibold">Aún no está disponible. ¿Te avisamos?</p>
      <input type="email" className="input" placeholder="tu@correo.com (vacío si ya iniciaste sesión)" value={email} onChange={(e) => setEmail(e.target.value)} />
      <ErrorBanner error={error} />
      <Button type="submit" loading={loading} className="w-full">
        Anotarme en la lista de espera
      </Button>
    </form>
  );
}

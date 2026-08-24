'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { Button, ErrorBanner, Field } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import type { Address } from '@/lib/recompry/types';

export function AddressManager({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(addresses.length === 0);
  const [form, setForm] = useState({ label: '', line1: '', line2: '', city: '', instructions: '', is_default: addresses.length === 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UiError | null>(null);

  async function create(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await callApi<Address>('/api/addresses', {
        body: { label: form.label || null, line1: form.line1, line2: form.line2 || null, city: form.city || null, country: 'CO', instructions: form.instructions || null, is_default: form.is_default },
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      });
      setForm({ label: '', line1: '', line2: '', city: '', instructions: '', is_default: false });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(toUiError(err));
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    if (!confirm('¿Eliminar esta dirección?')) return;
    try {
      await callApi(`/api/addresses/${id}`, { method: 'DELETE' });
      router.refresh();
    } catch (err) {
      setError(toUiError(err));
    }
  }

  return (
    <div className="space-y-3">
      {addresses.length ? (
        <ul className="divide-y divide-slate-100">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{a.label ?? 'Dirección'}{a.is_default ? <span className="ml-2 rounded bg-slate-100 px-1.5 text-[10px] font-semibold uppercase text-slate-500">predeterminada</span> : null}</p>
                <p className="text-slate-600">{[a.line1, a.line2, a.city].filter(Boolean).join(', ')}</p>
                {a.instructions ? <p className="text-xs text-slate-400">{a.instructions}</p> : null}
              </div>
              <button type="button" className="text-xs text-slate-500 hover:text-red-600" onClick={() => remove(a.id)}>Eliminar</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Aún no tienes direcciones guardadas.</p>
      )}
      <ErrorBanner error={error} />
      {open ? (
        <form onSubmit={create} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
          <Field label="Etiqueta" htmlFor="ad-label"><input id="ad-label" className="input" placeholder="Casa" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></Field>
          <Field label="Ciudad" htmlFor="ad-city"><input id="ad-city" className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Dirección" htmlFor="ad-line1"><input id="ad-line1" className="input" required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} placeholder="Calle 93 #11-27" /></Field></div>
          <Field label="Apto / torre" htmlFor="ad-line2"><input id="ad-line2" className="input" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} /></Field>
          <Field label="Indicaciones" htmlFor="ad-instr"><input id="ad-instr" className="input" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} /> Usar como predeterminada</label>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" loading={loading}>Guardar dirección</Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Agregar dirección</Button>
      )}
    </div>
  );
}

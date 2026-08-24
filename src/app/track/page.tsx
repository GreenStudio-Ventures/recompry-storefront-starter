import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Button, SectionTitle } from '@/components/ui';

export const metadata: Metadata = { title: 'Rastrear pedido' };

export default async function TrackIndexPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  if (code?.trim()) redirect(`/track/${encodeURIComponent(code.trim().toUpperCase())}`);
  return (
    <div className="mx-auto max-w-md">
      <SectionTitle title="Rastrear pedido" subtitle="Escribe el código de seguimiento que recibiste al confirmar." />
      <form action="/track" className="card flex gap-2 p-4">
        <input name="code" className="input uppercase" placeholder="K7M2P9QA" required maxLength={32} autoComplete="off" />
        <Button type="submit">Buscar</Button>
      </form>
    </div>
  );
}

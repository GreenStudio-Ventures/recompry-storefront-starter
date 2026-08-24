import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OtpLoginForm } from '@/components/account/OtpLoginForm';
import { SectionTitle } from '@/components/ui';
import { getBuyerSession } from '@/lib/recompry/session';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
  const { session } = await getBuyerSession();
  if (session) redirect(safeNext);
  return (
    <div className="mx-auto max-w-md">
      <SectionTitle title="Iniciar sesión" subtitle="Sin contraseña: te enviamos un código a tu correo." />
      <OtpLoginForm next={safeNext} />
    </div>
  );
}

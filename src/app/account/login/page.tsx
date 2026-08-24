import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { OtpLoginForm } from '@/components/account/OtpLoginForm';
import { SessionRefresher } from '@/components/account/SessionRefresher';
import { SectionTitle } from '@/components/ui';
import { getBuyerSession } from '@/lib/recompry/session';
import { safeNextPath } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'Iniciar sesión' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // `next` viene de la URL: sin normalizar, `/\evil.com` sería un open redirect post-login.
  const safeNext = safeNextPath(next);
  // Página: no renueva (consumiría el refresh_token sin poder guardar el nuevo). Si la sesión
  // venció, <SessionRefresher/> la renueva vía handler y vuelve a renderizar (o limpia la cookie).
  const { session, expired } = await getBuyerSession({ refresh: false });
  if (session) redirect(safeNext);
  if (expired) return <SessionRefresher next={safeNext} onFailure="stay" />;
  return (
    <div className="mx-auto max-w-md">
      <SectionTitle title="Iniciar sesión" subtitle="Sin contraseña: te enviamos un código a tu correo." />
      <OtpLoginForm next={safeNext} />
    </div>
  );
}

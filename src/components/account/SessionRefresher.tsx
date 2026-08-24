'use client';

// El server component detectó el access_token vencido: un route handler sí puede renovar y
// reescribir la cookie; luego volvemos a renderizar. Las páginas NUNCA renuevan por sí mismas
// (el refresh rota el token y sin persistirlo se pierde la sesión). Si no se puede renovar,
// el handler ya limpió la cookie: según `onFailure` vamos al login o re-renderizamos como invitado.
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Spinner } from '@/components/ui';
import { callApi } from '@/lib/browser-api';
import { safeNextPath } from '@/lib/safe-next';

type Props = {
  next: string;
  /** `login` (default): manda a /account/login?next=…; `stay`: re-renderiza la página actual sin sesión (p. ej. checkout). */
  onFailure?: 'login' | 'stay';
};

export function SessionRefresher({ next, onFailure = 'login' }: Props) {
  const router = useRouter();
  const [unreachable, setUnreachable] = useState(false);
  // `next` acaba en la URL del login: se sanea aquí también para no propagar un open redirect.
  const loginHref = `/account/login?next=${encodeURIComponent(safeNextPath(next))}`;
  useEffect(() => {
    let active = true;
    callApi<{ authenticated: boolean }>('/api/auth/refresh', { method: 'POST', body: {} })
      .then((r) => {
        if (!active) return;
        // Sin `authenticated` el handler ya limpió la cookie: re-renderizar no vuelve a caer aquí.
        if (r.authenticated || onFailure === 'stay') router.refresh();
        else router.replace(loginHref);
      })
      // El handler no respondió (offline/5xx): la cookie vencida sigue ahí y un `router.refresh()`
      // volvería a montar este componente en bucle. Paramos y dejamos que el usuario reintente.
      .catch(() => active && setUnreachable(true));
    return () => {
      active = false;
    };
  }, [router, onFailure, loginHref]);
  if (unreachable) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-sm text-slate-500">
        <p>No pudimos renovar tu sesión.</p>
        <div className="flex gap-4">
          <button type="button" className="underline" onClick={() => router.refresh()}>Reintentar</button>
          <Link href={loginHref} className="underline">Iniciar sesión de nuevo</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-slate-400">
      <Spinner className="h-6 w-6" /> Renovando sesión…
    </div>
  );
}

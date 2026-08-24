import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import './globals.css';
import { Footer } from '@/components/Footer';
import { Header } from '@/components/Header';
import { Providers } from '@/components/Providers';
import { brandStyle } from '@/lib/brand';
import { isApiError } from '@/lib/recompry/errors';
import type { Store } from '@/lib/recompry/types';
import { enabledModes, getStore } from '@/lib/store';

// Todo el storefront se renderiza por request contra el API (sin prerender en build).
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const store = await getStore();
    return {
      title: { default: store.name, template: `%s · ${store.name}` },
      description: store.branding.description ?? `Tienda online de ${store.name}`,
      icons: store.branding.logo ? { icon: store.branding.logo.thumb } : undefined,
    };
  } catch {
    return { title: 'Tienda' };
  }
}

type SetupError = { message: string; code?: string; requestId?: string | null };

function SetupScreen({ error }: { error: SetupError }) {
  return (
    <main className="container-x flex min-h-screen items-center justify-center py-16">
      <div className="card max-w-xl p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recompry Storefront Starter</p>
        <h1 className="mt-2 text-2xl font-bold">La tienda no pudo cargar</h1>
        <p className="mt-3 text-sm text-slate-600">{error.message}</p>
        {error.code ? (
          <p className="mt-1 font-mono text-xs text-slate-400">
            {error.code}
            {error.requestId ? ` · ${error.requestId}` : ''}
          </p>
        ) : null}
        <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>
            Emite una API key en <span className="font-semibold">app.recompry.com → Configuración → API keys</span>.
          </li>
          <li>
            Copia <code className="rounded bg-slate-100 px-1">.env.example</code> a <code className="rounded bg-slate-100 px-1">.env.local</code> y pega{' '}
            <code className="rounded bg-slate-100 px-1">RECOMPRY_PUBLISHABLE_KEY</code> y <code className="rounded bg-slate-100 px-1">RECOMPRY_SECRET_KEY</code>.
          </li>
          <li>
            Reinicia <code className="rounded bg-slate-100 px-1">npm run dev</code>. Documentación:{' '}
            <a className="underline" href="https://api.recompry.com/docs" target="_blank" rel="noreferrer">
              api.recompry.com/docs
            </a>
            .
          </li>
        </ol>
      </div>
    </main>
  );
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  let store: Store | null = null;
  let error: SetupError | null = null;
  try {
    store = await getStore();
  } catch (err) {
    error = isApiError(err)
      ? { message: err.message, code: err.code, requestId: err.requestId }
      : { message: err instanceof Error ? err.message : 'Error desconocido' };
  }
  const style = brandStyle(store) as CSSProperties;
  const defaultMode = store ? (enabledModes(store)[0]?.mode ?? 'pickup') : 'pickup';

  return (
    <html lang="es">
      <body style={style} className="flex min-h-screen flex-col">
        {store ? (
          <Providers defaultMode={defaultMode}>
            <Header store={store} />
            <main className="container-x flex-1 py-6 sm:py-8">{children}</main>
            <Footer store={store} />
          </Providers>
        ) : (
          <SetupScreen error={error ?? { message: 'Error desconocido' }} />
        )}
      </body>
    </html>
  );
}

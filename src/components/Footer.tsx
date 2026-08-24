import Link from 'next/link';
import type { Store } from '@/lib/recompry/types';

export function Footer({ store }: { store: Store }) {
  const social = Object.entries(store.social_links ?? {}).filter(([, v]) => typeof v === 'string' && v) as Array<[string, string]>;
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="container-x grid gap-8 py-10 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <p className="text-base font-bold text-slate-900">{store.name}</p>
          {store.branding.description ? <p className="mt-2 max-w-xs">{store.branding.description}</p> : null}
        </div>
        <div>
          <p className="font-semibold text-slate-900">Contacto</p>
          <ul className="mt-2 space-y-1">
            {store.contact.phone ? <li><a className="hover:underline" href={`tel:${store.contact.phone}`}>{store.contact.phone}</a></li> : null}
            {store.contact.whatsapp ? (
              <li><a className="hover:underline" href={`https://wa.me/${store.contact.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a></li>
            ) : null}
            {store.contact.email ? <li><a className="hover:underline" href={`mailto:${store.contact.email}`}>{store.contact.email}</a></li> : null}
            {!store.contact.phone && !store.contact.whatsapp && !store.contact.email ? <li className="text-slate-400">Sin datos de contacto</li> : null}
          </ul>
          {social.length ? (
            <ul className="mt-3 flex flex-wrap gap-3">
              {social.map(([k, v]) => (
                <li key={k}><a className="capitalize hover:underline" href={v} target="_blank" rel="noreferrer">{k}</a></li>
              ))}
            </ul>
          ) : null}
        </div>
        <div>
          <p className="font-semibold text-slate-900">Ayuda</p>
          <ul className="mt-2 space-y-1">
            <li><Link className="hover:underline" href="/track">Rastrear un pedido</Link></li>
            <li><Link className="hover:underline" href="/account">Mi cuenta</Link></li>
          </ul>
          <p className="mt-6 text-xs text-slate-400">
            Tienda construida con el{' '}
            <a className="underline" href="https://api.recompry.com/docs" target="_blank" rel="noreferrer">API de Recompry</a>.
          </p>
        </div>
      </div>
    </footer>
  );
}

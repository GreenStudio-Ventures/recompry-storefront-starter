'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ErrorBanner } from '@/components/ui';
import { callApi, toUiError, type UiError } from '@/lib/browser-api';
import { formatDate } from '@/lib/format';
import type { WaitlistEntry } from '@/lib/recompry/types';

export function WaitlistList({ entries }: { entries: WaitlistEntry[] }) {
  const router = useRouter();
  const [error, setError] = useState<UiError | null>(null);
  if (!entries.length) return <p className="text-sm text-slate-500">No estás en ninguna lista de espera.</p>;
  return (
    <div>
      <ul className="divide-y divide-slate-100 text-sm">
        {entries.map((e) => (
          <li key={e.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <Link href={`/p/${encodeURIComponent(e.product?.slug ?? e.product_id)}`} className="font-medium hover:underline">{e.product?.name ?? 'Producto'}</Link>
              <p className="text-xs text-slate-500">
                {e.status}{e.product?.launch_date ? ` · lanza ${formatDate(e.product.launch_date, { dateStyle: 'medium', timeStyle: undefined })}` : ''}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-slate-500 hover:text-red-600"
              onClick={async () => {
                try {
                  await callApi(`/api/waitlist/${e.id}`, { method: 'DELETE' });
                  router.refresh();
                } catch (err) {
                  setError(toUiError(err));
                }
              }}
            >
              Salir
            </button>
          </li>
        ))}
      </ul>
      <ErrorBanner error={error} className="mt-2" />
    </div>
  );
}

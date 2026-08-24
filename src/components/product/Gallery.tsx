'use client';

import { useState } from 'react';
import { ApiImage } from '@/components/ApiImage';
import { cn } from '@/lib/cn';
import type { ImageSet, Product } from '@/lib/recompry/types';

type Img = NonNullable<ImageSet>;

export function Gallery({ images, fallback, name }: { images: Product['images']; fallback: ImageSet | null; name: string }) {
  // Cada ImageSet puede venir null en el schema: se filtran antes de renderizar.
  const list: Img[] = (images.length ? images : fallback ? [fallback] : []).filter((i): i is Img => Boolean(i));
  const [active, setActive] = useState(0);
  const current = list[active] ?? list[0] ?? null;

  return (
    <div>
      <div className="card aspect-square overflow-hidden">
        <ApiImage image={current} alt={name} priority sizes="(min-width: 1024px) 50vw, 100vw" className="h-full w-full object-cover" />
      </div>
      {list.length > 1 ? (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
          {list.map((img, i) => (
            <button
              key={img.original + i}
              type="button"
              onClick={() => setActive(i)}
              className={cn('h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2', i === active ? 'border-brand' : 'border-transparent')}
              aria-label={`Imagen ${i + 1}`}
            >
              <img src={img.thumb} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

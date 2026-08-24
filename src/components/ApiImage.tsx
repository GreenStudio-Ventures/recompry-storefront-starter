import { cn } from '@/lib/cn';
import type { ImageSet } from '@/lib/recompry/types';

/**
 * Imagen del API: cada una llega como `{ original, thumb(160), md(480), lg(1080) }` en WebP.
 * Usamos <img> con srcSet (sin optimizador de Next: no corre en Workers y no hace falta).
 */
export function ApiImage({
  image,
  alt,
  className,
  sizes = '(min-width: 1024px) 25vw, 50vw',
  priority = false,
}: {
  image: ImageSet | null | undefined;
  alt: string;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  if (!image) {
    return (
      <div className={cn('flex items-center justify-center bg-slate-100', className)} aria-hidden>
        <img src="/placeholder.svg" alt="" className="h-full w-full object-cover opacity-80" />
      </div>
    );
  }
  return (
    <img
      src={image.md}
      srcSet={`${image.thumb} 160w, ${image.md} 480w, ${image.lg} 1080w`}
      sizes={sizes}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}

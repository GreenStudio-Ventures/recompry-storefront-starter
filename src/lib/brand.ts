import type { Store } from '@/lib/recompry/types';

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function safeColor(value: unknown): string | null {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : null;
}

function luminance(hex: string): number {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

/** `#0f172a` → `15 23 42` (Tailwind necesita el triplete para `bg-brand/20`, `ring-brand/15`, etc.). */
function rgbTriplet(hex: string): string {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(' ');
}

/** Variables CSS de marca a partir de `branding.colors` (con defaults sobrios y texto legible). */
export function brandStyle(store: Store | null): Record<`--${string}`, string> {
  const colors = store?.branding.colors;
  const primary = safeColor(colors?.primary) ?? '#0f172a';
  const secondary = safeColor(colors?.secondary) ?? '#475569';
  const accent = safeColor(colors?.accent) ?? '#f59e0b';
  return {
    '--brand-primary': primary,
    '--brand-primary-rgb': rgbTriplet(primary),
    '--brand-secondary': secondary,
    '--brand-secondary-rgb': rgbTriplet(secondary),
    '--brand-accent': accent,
    '--brand-accent-rgb': rgbTriplet(accent),
    '--brand-foreground': luminance(primary) > 0.45 ? '#0f172a' : '#ffffff',
  };
}

export function storeTitle(store: Store): string {
  const { title_init, title_last } = store.branding;
  if (title_init || title_last) return [title_init, title_last].filter(Boolean).join(' ');
  return store.name;
}

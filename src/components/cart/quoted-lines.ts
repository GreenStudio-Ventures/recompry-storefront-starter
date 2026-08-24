import type { CartQuote } from '@/lib/recompry/types';
import type { CartLine } from '@/lib/cart/types';

/** Línea cotizada (el alias no existe en lib/recompry/types; se deriva de `CartQuote`). */
export type CartQuoteLine = CartQuote['lines'][number];

// Empareja cada línea local con su cotización. `POST /v1/cart/quote` conserva el orden del
// request y solo omite las líneas de los productos reportados en `issues` (con `product_id`),
// así que la alineación es posicional. Emparejar por producto+variante+cantidad (como antes)
// confundía dos líneas del mismo producto con distintos extras/comentario (mostraba el precio
// de la primera) y fallaba cuando la sucursal auto-sirve una variante que el cliente no eligió.
export function matchQuotedLines(lines: readonly CartLine[], quote: CartQuote | null | undefined): Map<string, CartQuoteLine> {
  const out = new Map<string, CartQuoteLine>();
  if (!quote) return out;
  const excluded = new Set(quote.issues.map((i) => i.product_id?.toLowerCase()).filter((id): id is string => Boolean(id)));
  const candidates = lines.filter((l) => !excluded.has(l.product_id.toLowerCase()));
  if (candidates.length === quote.lines.length) {
    candidates.forEach((line, idx) => {
      const q = quote.lines[idx];
      if (q && q.product_id.toLowerCase() === line.product_id.toLowerCase()) out.set(line.key, q);
    });
    if (out.size === quote.lines.length) return out;
    out.clear();
  }
  // Desalineación (respuesta vieja frente a un carrito ya editado): cae a una clave que sí
  // distingue extras y comentario, tomando cada línea cotizada una sola vez.
  const used = new Set<number>();
  for (const line of candidates) {
    const idx = quote.lines.findIndex((q, i) => !used.has(i) && sameLine(line, q));
    if (idx >= 0) {
      used.add(idx);
      out.set(line.key, quote.lines[idx]!);
    }
  }
  return out;
}

function sameLine(line: CartLine, q: CartQuoteLine): boolean {
  if (q.product_id.toLowerCase() !== line.product_id.toLowerCase() || q.quantity !== line.quantity) return false;
  // Variante: si el cliente no eligió, la sucursal puede auto-servir una; solo se compara cuando ambas existen.
  if (line.variant_id && q.variant_id && line.variant_id.toLowerCase() !== q.variant_id.toLowerCase()) return false;
  const local = line.modifiers.flatMap((m) => m.modifier_ids.map((id) => id.toLowerCase())).sort().join('+');
  const quoted = q.modifiers.map((m) => m.id.toLowerCase()).sort().join('+');
  return local === quoted && (line.comment ?? '').trim() === (q.comment ?? '').trim();
}

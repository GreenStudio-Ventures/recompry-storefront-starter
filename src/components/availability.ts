// Etiqueta de disponibilidad común a los dos vocabularios del contrato:
//  - `Product` (catálogo/PDP): availability `in_stock|low_stock|out_of_stock|unknown` + `is_waitlist_enabled`.
//  - `SearchProduct` (/v1/search): availability `in_stock|sold_out|waitlist|coming_soon`, SIN `is_waitlist_enabled`.
// Si solo se mira `is_available`, un resultado de búsqueda en lista de espera sale como «Agotado».
export type AvailabilityInput = {
  availability?: string;
  is_available?: boolean;
  is_waitlist_enabled?: boolean;
};

export type AvailabilityBadgeSpec = { tone: 'info' | 'danger' | 'warning'; label: string };

export function availabilityBadge(p: AvailabilityInput): AvailabilityBadgeSpec | null {
  const upcoming = p.availability === 'waitlist' || p.availability === 'coming_soon' || (p.is_waitlist_enabled === true && p.is_available === false);
  if (upcoming) return { tone: 'info', label: 'Próximamente' };
  if (p.is_available === false || p.availability === 'out_of_stock' || p.availability === 'sold_out') return { tone: 'danger', label: 'Agotado' };
  if (p.availability === 'low_stock') return { tone: 'warning', label: 'Pocas unidades' };
  return null;
}

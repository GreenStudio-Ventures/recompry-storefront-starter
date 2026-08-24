import { describe, expect, it } from 'vitest';
import { availabilityBadge } from './availability';

describe('availabilityBadge', () => {
  it('Product: lista de espera sale como Próximamente aunque is_available sea false', () => {
    expect(availabilityBadge({ availability: 'out_of_stock', is_available: false, is_waitlist_enabled: true })?.label).toBe('Próximamente');
  });

  it('Product: agotado / pocas unidades / comprable', () => {
    expect(availabilityBadge({ availability: 'out_of_stock', is_available: false, is_waitlist_enabled: false })?.label).toBe('Agotado');
    expect(availabilityBadge({ availability: 'low_stock', is_available: true, is_waitlist_enabled: false })?.label).toBe('Pocas unidades');
    expect(availabilityBadge({ availability: 'in_stock', is_available: true, is_waitlist_enabled: false })).toBeNull();
    // `unknown` = el negocio no rastrea stock: comprable, sin etiqueta.
    expect(availabilityBadge({ availability: 'unknown', is_available: true, is_waitlist_enabled: false })).toBeNull();
  });

  it('SearchProduct: waitlist/coming_soon NO son «Agotado» (no trae is_waitlist_enabled)', () => {
    expect(availabilityBadge({ availability: 'waitlist', is_available: false })?.label).toBe('Próximamente');
    expect(availabilityBadge({ availability: 'coming_soon', is_available: false })?.label).toBe('Próximamente');
    expect(availabilityBadge({ availability: 'sold_out', is_available: false })?.label).toBe('Agotado');
    expect(availabilityBadge({ availability: 'in_stock', is_available: true })).toBeNull();
  });

  it('valor desconocido del enum extensible: no comprable → Agotado (is_available manda)', () => {
    expect(availabilityBadge({ availability: 'algo_nuevo', is_available: false })?.label).toBe('Agotado');
  });
});

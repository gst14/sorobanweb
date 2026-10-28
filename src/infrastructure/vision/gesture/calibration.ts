import type { Calibration } from '@/application/ports';
import { beadUnits, deckAt } from '@/application/vision';
import { type Deck, type EarthSlot, type Rod, EARTH_SLOTS } from '@/domain';

export type { Calibration };
export { beadUnits };

/**
 * Centro de cada cuenta medido desde la viga, en alturas de cuenta y siempre positivo.
 * Las activas tocan la viga; las inactivas quedan del otro lado del hueco.
 */
export const heavenCenter = (rod: Rod): number => (rod.heaven ? 0.5 : 1.5);
export const earthCenter = (rod: Rod, slot: EarthSlot): number =>
  slot < rod.earth ? slot + 0.5 : slot + 1.5;

export interface BeadHit {
  readonly deck: Deck;
  readonly slot: EarthSlot;
}

/** Cuenta más cercana a la posición `u` (de `beadUnits`), o null si está fuera de las secciones. */
export function hitBead(rod: Rod, u: number): BeadHit | null {
  const deck = deckAt(u);
  if (deck === null) return null;
  if (deck === 'heaven') return { deck, slot: 0 };
  let best: EarthSlot = 0;
  for (const slot of EARTH_SLOTS) {
    if (Math.abs(earthCenter(rod, slot) - u) < Math.abs(earthCenter(rod, best) - u)) best = slot;
  }
  return { deck: 'earth', slot: best };
}

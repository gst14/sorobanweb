import type { Deck, MoveDelta } from './Move';
import { toEarthDelta } from './Move';
import type { Rod } from './Rod';

/** Posición de una cuenta de tierra: 0 = la más cercana a la viga, 3 = la más lejana. */
export type EarthSlot = 0 | 1 | 2 | 3;
export const EARTH_SLOTS: readonly EarthSlot[] = Object.freeze([0, 1, 2, 3]);

/** Dirección de un arrastre relativa a la viga. */
export type BeamDirection = 'toward' | 'away';

/**
 * Tap sobre una cuenta de tierra, con física real:
 * - si está activa (tocando la viga), baja junto con las que están más lejos de la viga;
 * - si está inactiva, sube junto con las que están entre ella y la viga.
 */
export function earthTap(rod: Rod, slot: EarthSlot): MoveDelta {
  const target = slot < rod.earth ? slot : slot + 1;
  return { deck: 'earth', delta: toEarthDelta(target - rod.earth) };
}

/** Tap sobre la cuenta del cielo: la invierte. */
export const heavenTap = (rod: Rod): MoveDelta => ({
  deck: 'heaven',
  delta: rod.heaven ? -1 : 1,
});

/**
 * Arrastre que empieza sobre una cuenta. Solo produce movimiento si la cuenta puede ir en esa
 * dirección; si no (por ejemplo, empujar hacia la viga una cuenta que ya la toca), devuelve null.
 * Para el cielo, `slot` se ignora.
 */
export function dragMove(
  rod: Rod,
  deck: Deck,
  direction: BeamDirection,
  slot: EarthSlot = 0,
): MoveDelta | null {
  const toward = direction === 'toward';
  if (deck === 'heaven') return rod.heaven === toward ? null : heavenTap(rod);
  const active = slot < rod.earth;
  return active === toward ? null : earthTap(rod, slot);
}

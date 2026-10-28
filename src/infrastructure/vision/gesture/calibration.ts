import { type Deck, type EarthSlot, type Rod, EARTH_SLOTS } from '@/domain';

/**
 * Dónde está el soroban "en el aire", en coordenadas normalizadas de pantalla.
 * Lo produce la calibración (índice en la viga y en las varillas extremas).
 */
export interface Calibration {
  /** x del borde izquierdo del ROI (varilla `rodCount − 1`). */
  readonly left: number;
  /** x del borde derecho del ROI (varilla 0). */
  readonly right: number;
  /** y de la viga. */
  readonly beamY: number;
  /** Alto de una cuenta, en unidades de y. */
  readonly beadHeight: number;
  readonly rodCount: number;
}

/** Recorrido de cada sección en alturas de cuenta: cielo = 1 cuenta + hueco; tierra = 4 + hueco. */
export const HEAVEN_TRACK = 2;
export const EARTH_TRACK = 5;

/** Margen fuera del recorrido en el que todavía se considera que el dedo está sobre la sección. */
const TRACK_MARGIN = 0.5;

/**
 * Posición vertical relativa a la viga, en alturas de cuenta.
 * Negativa = cielo (arriba de la viga); positiva = tierra.
 */
export const beadUnits = (cal: Calibration, y: number): number => (y - cal.beamY) / cal.beadHeight;

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
  if (u < 0) return -u <= HEAVEN_TRACK + TRACK_MARGIN ? { deck: 'heaven', slot: 0 } : null;
  if (u > EARTH_TRACK + TRACK_MARGIN) return null;
  let best: EarthSlot = 0;
  for (const slot of EARTH_SLOTS) {
    if (Math.abs(earthCenter(rod, slot) - u) < Math.abs(earthCenter(rod, best) - u)) best = slot;
  }
  return { deck: 'earth', slot: best };
}

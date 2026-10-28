import type { Calibration } from '@/application/ports';
import type { Deck } from '@/domain';

/**
 * Geometría del soroban "en el aire" a partir de la calibración. Vive en application porque la
 * usan la lógica de gestos (infraestructura) y el overlay de la mano (presentación).
 */

/** Recorrido de cada sección en alturas de cuenta: cielo = 1 cuenta + hueco; tierra = 4 + hueco. */
export const HEAVEN_TRACK = 2;
export const EARTH_TRACK = 5;

/** Margen fuera del recorrido en el que todavía se considera que el dedo está sobre la sección. */
export const TRACK_MARGIN = 0.5;

/**
 * Recuadro centrado que se usa mientras no haya calibración: el 70 % del ancho, con la viga
 * un poco arriba del centro para que entren el cielo y la tierra.
 */
export const defaultCalibration = (rodCount: number): Calibration => ({
  left: 0.15,
  right: 0.85,
  beamY: 0.4,
  beadHeight: 0.05,
  rodCount,
});

/**
 * Posición vertical relativa a la viga, en alturas de cuenta.
 * Negativa = cielo (arriba de la viga); positiva = tierra.
 */
export const beadUnits = (cal: Calibration, y: number): number => (y - cal.beamY) / cal.beadHeight;

/** Sección bajo la posición `u` (de `beadUnits`), con el margen incluido; null si está afuera. */
export function deckAt(u: number): Deck | null {
  if (u < 0) return -u <= HEAVEN_TRACK + TRACK_MARGIN ? 'heaven' : null;
  return u <= EARTH_TRACK + TRACK_MARGIN ? 'earth' : null;
}

/** Varilla (0 = derecha) bajo la x, sin histéresis; null fuera del ROI. */
export function rodAt(cal: Calibration, x: number): number | null {
  const column = Math.floor(((x - cal.left) / (cal.right - cal.left)) * cal.rodCount);
  return column >= 0 && column < cal.rodCount ? cal.rodCount - 1 - column : null;
}

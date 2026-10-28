export type Deck = 'heaven' | 'earth';
export type Finger = 'thumb' | 'index' | 'unknown';

/** Tierra: cuentas movidas; positivo = hacia la viga (suma). */
export type EarthDelta = -4 | -3 | -2 | -1 | 1 | 2 | 3 | 4;
/** Cielo: +1 = bajar la cuenta (suma 5), -1 = subirla (resta 5). */
export type HeavenDelta = 1 | -1;

interface MoveBase {
  /** 0 = varilla de la derecha. */
  readonly rod: number;
  readonly finger: Finger;
  /** Timestamp en ms, provisto por un Clock. */
  readonly at: number;
}

export interface EarthMove extends MoveBase {
  readonly deck: 'earth';
  readonly delta: EarthDelta;
}

export interface HeavenMove extends MoveBase {
  readonly deck: 'heaven';
  readonly delta: HeavenDelta;
}

/** Un movimiento de cuentas. Las tres entradas (gestos, táctil, teclado) emiten Move. */
export type Move = EarthMove | HeavenMove;

export const isEarthDelta = (n: number): n is EarthDelta =>
  Number.isInteger(n) && n !== 0 && Math.abs(n) <= 4;

export function toEarthDelta(n: number): EarthDelta {
  if (!isEarthDelta(n)) throw new RangeError(`Delta de tierra inválido: ${n}`);
  return n;
}

/** Valor con signo que el movimiento suma a su varilla. */
export const moveValue = (m: Pick<Move, 'deck' | 'delta'>): number =>
  m.deck === 'earth' ? m.delta : 5 * m.delta;

/** Dedo correcto según la técnica tradicional: el pulgar solo sube cuentas de tierra. */
export const expectedFinger = (m: Pick<Move, 'deck' | 'delta'>): Finger =>
  m.deck === 'earth' && m.delta > 0 ? 'thumb' : 'index';

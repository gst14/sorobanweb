export type Digit = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type NonZeroDigit = Exclude<Digit, 0>;
/** Cuentas de tierra apoyadas en la viga. */
export type EarthCount = 0 | 1 | 2 | 3 | 4;

export const DIGITS: readonly Digit[] = Object.freeze([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
export const NON_ZERO_DIGITS: readonly NonZeroDigit[] = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9]);

const inRange = (n: number, max: number): boolean => Number.isInteger(n) && n >= 0 && n <= max;

export const isDigit = (n: number): n is Digit => inRange(n, 9);
export const isEarthCount = (n: number): n is EarthCount => inRange(n, 4);

export function toDigit(n: number): Digit {
  if (!isDigit(n)) throw new RangeError(`Dígito fuera de rango: ${n}`);
  return n;
}

export function toEarthCount(n: number): EarthCount {
  if (!isEarthCount(n)) throw new RangeError(`Cuentas de tierra fuera de rango: ${n}`);
  return n;
}

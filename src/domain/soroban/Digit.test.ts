import { describe, expect, it } from 'vitest';
import {
  DIGITS,
  NON_ZERO_DIGITS,
  digitsOf,
  isDigit,
  isEarthCount,
  toDigit,
  toEarthCount,
} from './Digit';

describe('Digit', () => {
  it('DIGITS contiene 0..9 y NON_ZERO_DIGITS 1..9, congelados', () => {
    expect(DIGITS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(NON_ZERO_DIGITS).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(Object.isFrozen(DIGITS)).toBe(true);
    expect(Object.isFrozen(NON_ZERO_DIGITS)).toBe(true);
  });

  it.each([0, 5, 9])('isDigit(%d) es true', (n) => {
    expect(isDigit(n)).toBe(true);
  });

  it.each([-1, 10, 2.5, Number.NaN])('isDigit(%d) es false', (n) => {
    expect(isDigit(n)).toBe(false);
  });

  it.each([0, 4])('isEarthCount(%d) es true', (n) => {
    expect(isEarthCount(n)).toBe(true);
  });

  it.each([-1, 5, 1.5])('isEarthCount(%d) es false', (n) => {
    expect(isEarthCount(n)).toBe(false);
  });

  it('toDigit devuelve el valor o lanza RangeError', () => {
    expect(toDigit(7)).toBe(7);
    expect(() => toDigit(10)).toThrow(RangeError);
  });

  it('toEarthCount devuelve el valor o lanza RangeError', () => {
    expect(toEarthCount(3)).toBe(3);
    expect(() => toEarthCount(5)).toThrow(RangeError);
  });

  it('digitsOf devuelve los dígitos de derecha a izquierda', () => {
    expect(digitsOf(8036)).toEqual([6, 3, 0, 8]);
    expect(digitsOf(0)).toEqual([0]);
    expect(() => digitsOf(-1)).toThrow(RangeError);
    expect(() => digitsOf(1.5)).toThrow(RangeError);
  });
});

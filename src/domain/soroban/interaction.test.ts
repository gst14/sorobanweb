import { describe, expect, it } from 'vitest';
import type { Digit, EarthCount } from './Digit';
import {
  EARTH_SLOTS,
  type EarthSlot,
  dragMove,
  earthTap,
  heavenTap,
  isEarthSlot,
} from './interaction';
import { Rod } from './Rod';

const EARTH_STATES: readonly EarthCount[] = [0, 1, 2, 3, 4];
const rodWithEarth = (e: EarthCount): Rod => Rod.of(e);

/** Resultado esperado tras tocar `slot`, escrito como tabla: EXPECTED[earth][slot]. */
const EXPECTED_EARTH_AFTER_TAP: readonly (readonly EarthCount[])[] = [
  [1, 2, 3, 4], // 0 activas: tocar la cuenta s sube s+1 cuentas
  [0, 2, 3, 4], // 1 activa: tocar la 0 la baja; el resto sube
  [0, 1, 3, 4],
  [0, 1, 2, 4],
  [0, 1, 2, 3], // 4 activas: tocar la s deja s
];

describe('earthTap', () => {
  for (const e of EARTH_STATES) {
    for (const slot of EARTH_SLOTS) {
      const expected = EXPECTED_EARTH_AFTER_TAP[e]?.[slot];
      it(`con ${e} activas, tocar el slot ${slot} deja ${String(expected)}`, () => {
        const rod = rodWithEarth(e);
        const move = earthTap(rod, slot);
        expect(move.deck).toBe('earth');
        expect(rod.moveEarth(move.delta).earth).toBe(expected);
      });
    }
  }

  it('el caso de la reseña: con 3 activas, tocar la tercera (slot 2) deja 2', () => {
    expect(earthTap(rodWithEarth(3), 2)).toEqual({ deck: 'earth', delta: -1 });
  });

  it('respeta el cielo: con 7, tocar el slot 0 deja 5', () => {
    const rod = Rod.of(7);
    expect(rod.moveEarth(earthTap(rod, 0).delta).value).toBe(5);
  });
});

describe('heavenTap', () => {
  it.each<[Digit, 1 | -1]>([
    [3, 1],
    [8, -1],
  ])('desde %d mueve el cielo %d', (d, delta) => {
    expect(heavenTap(Rod.of(d))).toEqual({ deck: 'heaven', delta });
  });
});

describe('dragMove', () => {
  it('tierra hacia la viga desde una cuenta inactiva = tap', () => {
    const rod = rodWithEarth(1);
    expect(dragMove(rod, 'earth', 'toward', 3)).toEqual(earthTap(rod, 3));
  });

  it('tierra alejándose desde una cuenta activa = tap', () => {
    const rod = rodWithEarth(3);
    expect(dragMove(rod, 'earth', 'away', 1)).toEqual(earthTap(rod, 1));
  });

  it.each<[EarthCount, EarthSlot, 'toward' | 'away']>([
    [3, 1, 'toward'],
    [1, 2, 'away'],
    [0, 0, 'away'],
    [4, 3, 'toward'],
  ])('con %d activas, arrastrar el slot %d %s no hace nada', (e, slot, dir) => {
    expect(dragMove(rodWithEarth(e), 'earth', dir, slot)).toBeNull();
  });

  it('el slot por defecto es el 0', () => {
    expect(dragMove(rodWithEarth(0), 'earth', 'toward')).toEqual({ deck: 'earth', delta: 1 });
  });

  it('cielo: hacia la viga baja, alejándose sube, y nada si ya está ahí', () => {
    expect(dragMove(Rod.of(0), 'heaven', 'toward')).toEqual({ deck: 'heaven', delta: 1 });
    expect(dragMove(Rod.of(5), 'heaven', 'away')).toEqual({ deck: 'heaven', delta: -1 });
    expect(dragMove(Rod.of(5), 'heaven', 'toward')).toBeNull();
    expect(dragMove(Rod.of(0), 'heaven', 'away')).toBeNull();
  });
});

describe('isEarthSlot', () => {
  it('acepta 0..3 enteros', () => {
    expect(EARTH_SLOTS.every(isEarthSlot)).toBe(true);
    expect([-1, 4, 1.5, Number.NaN].some(isEarthSlot)).toBe(false);
  });
});

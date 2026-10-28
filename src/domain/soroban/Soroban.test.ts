import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Digit } from './Digit';
import { InvalidMoveError } from './errors';
import { type EarthDelta, type Move, toEarthDelta } from './Move';
import { Rod } from './Rod';
import { Soroban } from './Soroban';

const earth = (rod: number, delta: EarthDelta): Move => ({
  rod,
  deck: 'earth',
  delta,
  finger: 'unknown',
  at: 0,
});
const heaven = (rod: number, delta: 1 | -1): Move => ({
  rod,
  deck: 'heaven',
  delta,
  finger: 'unknown',
  at: 0,
});

describe('Soroban', () => {
  describe('create', () => {
    it('crea un soroban vacío con la cantidad de varillas pedida', () => {
      const s = Soroban.create(7);
      expect(s.rodCount).toBe(7);
      expect(s.unitRod).toBe(0);
      expect(s.toNumber()).toBe(0);
    });

    it.each([2, 4, 1, 0, -3, 7.5])('rechaza %d varillas (debe ser impar y ≥ 3)', (n) => {
      expect(() => Soroban.create(n)).toThrow(RangeError);
    });

    it.each([-1, 7, 1.5])('rechaza unitRod = %d con 7 varillas', (u) => {
      expect(() => Soroban.create(7, u)).toThrow(RangeError);
    });

    it('fromDigits valida la cantidad de varillas', () => {
      expect(() => Soroban.fromDigits([1, 2])).toThrow(RangeError);
      expect(Soroban.fromDigits([3, 2, 1]).toNumber()).toBe(123);
    });
  });

  describe('fromNumber / toNumber / digits', () => {
    it('coloca 8036 desde la derecha', () => {
      const s = Soroban.fromNumber(8036, 7);
      expect(s.digits()).toEqual([6, 3, 0, 8, 0, 0, 0]);
      expect(s.toNumber()).toBe(8036);
    });

    it('con la unidad en la varilla 2, 8036 se corre dos varillas y 6308000 se lee 80.36', () => {
      const s = Soroban.fromNumber(8036, 7, 2);
      expect(s.digits()).toEqual([0, 0, 6, 3, 0, 8, 0]);
      expect(s.toNumber()).toBe(8036);
      expect(Soroban.fromDigits([6, 3, 0, 8, 0, 0, 0], 2).toNumber()).toBe(80.36);
    });

    it('rechaza negativos, no enteros y números que no entran', () => {
      expect(() => Soroban.fromNumber(-1, 7)).toThrow(RangeError);
      expect(() => Soroban.fromNumber(1.5, 7)).toThrow(RangeError);
      expect(() => Soroban.fromNumber(10_000_000, 7)).toThrow(RangeError);
      expect(() => Soroban.fromNumber(1000, 5, 2)).toThrow(RangeError);
    });

    it('toNumber lanza si el valor no es un entero seguro (17 varillas en 9)', () => {
      const nines: Digit[] = Array.from({ length: 17 }, () => 9);
      expect(() => Soroban.fromDigits(nines).toNumber()).toThrow(RangeError);
    });

    it('fromNumber y toNumber son inversas (propiedad)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 9_999_999 }), (n) => {
          expect(Soroban.fromNumber(n, 7).toNumber()).toBe(n);
        }),
      );
    });

    it('digits está congelado', () => {
      expect(Object.isFrozen(Soroban.create(3).digits())).toBe(true);
    });
  });

  describe('rodAt / rodValue / withRod', () => {
    it('lee y reemplaza varillas', () => {
      const s = Soroban.create(3).withRod(1, Rod.of(7));
      expect(s.rodValue(1)).toBe(7);
      expect(s.rodAt(1).heaven).toBe(true);
      expect(s.toNumber()).toBe(70);
    });

    it('lanza con índices inexistentes', () => {
      const s = Soroban.create(3);
      expect(() => s.rodAt(3)).toThrow(RangeError);
      expect(() => s.withRod(-1, Rod.ZERO)).toThrow(RangeError);
    });
  });

  describe('apply', () => {
    it('suma y resta cuentas de tierra y de cielo', () => {
      const s = Soroban.create(3)
        .apply(earth(0, 3))
        .apply(heaven(1, 1))
        .apply(earth(1, 2))
        .apply(earth(0, -1));
      expect(s.toNumber()).toBe(72);
      expect(s.apply(heaven(1, -1)).toNumber()).toBe(22);
    });

    it('el caso de la reseña: subir 3 y bajar 1 deja 2', () => {
      expect(Soroban.create(3).apply(earth(0, 3)).apply(earth(0, -1)).toNumber()).toBe(2);
    });

    it('es inmutable', () => {
      const s = Soroban.create(3);
      const t = s.apply(earth(0, 1));
      expect(s.toNumber()).toBe(0);
      expect(t.toNumber()).toBe(1);
      expect(Object.isFrozen(s)).toBe(true);
      expect(Object.isFrozen(s.rods)).toBe(true);
    });

    it.each<[string, Move]>([
      ['varilla inexistente', earth(5, 1)],
      ['restar tierra en 0', earth(0, -1)],
      ['subir el cielo si ya está arriba', heaven(0, -1)],
    ])('rechaza %s', (_, move) => {
      const s = Soroban.create(3);
      expect(s.canApply(move)).toBe(false);
      expect(() => s.apply(move)).toThrow(InvalidMoveError);
    });

    it('rechaza bajar el cielo si ya está abajo, y el error conserva el move', () => {
      const s = Soroban.fromNumber(5, 3);
      const move = heaven(0, 1);
      expect(s.canApply(move)).toBe(false);
      try {
        s.apply(move);
        expect.unreachable();
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidMoveError);
        expect(e).toHaveProperty('move', move);
        expect(e).toHaveProperty('name', 'InvalidMoveError');
      }
    });

    it('un move de tierra y su inverso vuelven al estado original (propiedad)', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 999 }),
          fc.integer({ min: 0, max: 2 }),
          fc.constantFrom<EarthDelta>(-4, -3, -2, -1, 1, 2, 3, 4),
          (n, rod, delta) => {
            const s = Soroban.fromNumber(n, 3);
            fc.pre(s.canApply(earth(rod, delta)));
            const back = s.apply(earth(rod, delta)).apply(earth(rod, toEarthDelta(-delta)));
            expect(back.equals(s)).toBe(true);
          },
        ),
      );
    });
  });

  it('clear vuelve a cero conservando forma', () => {
    const s = Soroban.fromNumber(123, 5, 1).clear();
    expect(s.toNumber()).toBe(0);
    expect(s.rodCount).toBe(5);
    expect(s.unitRod).toBe(1);
  });

  it('equals compara forma, unidad y cuentas', () => {
    const a = Soroban.fromNumber(42, 3);
    expect(a.equals(Soroban.fromNumber(42, 3))).toBe(true);
    expect(a.equals(Soroban.fromNumber(43, 3))).toBe(false);
    expect(a.equals(Soroban.fromNumber(42, 5))).toBe(false);
    expect(Soroban.create(3, 1).equals(Soroban.create(3))).toBe(false);
  });
});

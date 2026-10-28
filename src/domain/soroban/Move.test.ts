import { describe, expect, it } from 'vitest';
import { expectedFinger, isEarthDelta, moveValue, toEarthDelta, toMove } from './Move';

describe('Move', () => {
  describe('expectedFinger', () => {
    it('pulgar para subir cuentas de tierra', () => {
      expect(expectedFinger({ deck: 'earth', delta: 3 })).toBe('thumb');
    });

    it('índice para bajar cuentas de tierra', () => {
      expect(expectedFinger({ deck: 'earth', delta: -2 })).toBe('index');
    });

    it('índice para bajar y subir el cielo', () => {
      expect(expectedFinger({ deck: 'heaven', delta: 1 })).toBe('index');
      expect(expectedFinger({ deck: 'heaven', delta: -1 })).toBe('index');
    });
  });

  describe('moveValue', () => {
    it('tierra vale delta y cielo vale 5 × delta', () => {
      expect(moveValue({ deck: 'earth', delta: -3 })).toBe(-3);
      expect(moveValue({ deck: 'heaven', delta: 1 })).toBe(5);
      expect(moveValue({ deck: 'heaven', delta: -1 })).toBe(-5);
    });
  });

  describe('isEarthDelta / toEarthDelta', () => {
    it.each([-4, -1, 1, 4])('%d es válido', (n) => {
      expect(isEarthDelta(n)).toBe(true);
      expect(toEarthDelta(n)).toBe(n);
    });

    it.each([0, 5, -5, 1.5])('%d es inválido', (n) => {
      expect(isEarthDelta(n)).toBe(false);
      expect(() => toEarthDelta(n)).toThrow(RangeError);
    });
  });
});

describe('toMove', () => {
  it('agrega varilla, dedo e instante conservando deck y delta', () => {
    expect(toMove({ deck: 'heaven', delta: -1 }, 2, 'index', 1234)).toEqual({
      deck: 'heaven',
      delta: -1,
      rod: 2,
      finger: 'index',
      at: 1234,
    });
  });
});

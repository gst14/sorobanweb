import { describe, expect, it } from 'vitest';
import { DIGITS } from './Digit';
import { Rod } from './Rod';

describe('Rod', () => {
  it.each(DIGITS)('Rod.of(%d) tiene representación única y value correcto', (d) => {
    const rod = Rod.of(d);
    expect(rod.value).toBe(d);
    expect(rod.heaven).toBe(d >= 5);
    expect(rod.earth).toBe(d % 5);
  });

  it('7 = cielo abajo + 2 de tierra', () => {
    const seven = Rod.of(7);
    expect(seven.heaven).toBe(true);
    expect(seven.earth).toBe(2);
  });

  it('ZERO vale 0', () => {
    expect(Rod.ZERO.value).toBe(0);
    expect(Rod.ZERO.equals(Rod.of(0))).toBe(true);
  });

  it('es inmutable', () => {
    const rod = Rod.of(3);
    expect(Object.isFrozen(rod)).toBe(true);
    const moved = rod.moveEarth(1);
    expect(rod.value).toBe(3);
    expect(moved.value).toBe(4);
  });

  describe('moveEarth', () => {
    it('sube y baja cuentas de tierra', () => {
      expect(Rod.of(0).moveEarth(4).value).toBe(4);
      expect(Rod.of(9).moveEarth(-4).value).toBe(5);
      expect(Rod.of(6).moveEarth(-1).value).toBe(5);
    });

    it.each([
      [0, -1],
      [4, 1],
      [2, 3],
      [8, -4],
    ] as const)('desde %d no puede mover %d', (d, n) => {
      const rod = Rod.of(d);
      expect(rod.canMoveEarth(n)).toBe(false);
      expect(() => rod.moveEarth(n)).toThrow(RangeError);
    });

    it('rechaza cantidades no enteras', () => {
      expect(Rod.of(2).canMoveEarth(0.5)).toBe(false);
      expect(() => Rod.of(2).moveEarth(0.5)).toThrow(RangeError);
    });

    it('canMoveEarth es true en el rango válido', () => {
      expect(Rod.of(2).canMoveEarth(2)).toBe(true);
      expect(Rod.of(2).canMoveEarth(-2)).toBe(true);
      expect(Rod.of(2).canMoveEarth(0)).toBe(true);
    });
  });

  describe('setHeaven', () => {
    it('baja y sube la cuenta del cielo', () => {
      expect(Rod.of(3).setHeaven(true).value).toBe(8);
      expect(Rod.of(8).setHeaven(false).value).toBe(3);
    });

    it('devuelve la misma instancia si no cambia', () => {
      const rod = Rod.of(6);
      expect(rod.setHeaven(true)).toBe(rod);
    });
  });

  it('equals compara por valor', () => {
    expect(Rod.of(5).equals(Rod.of(0).setHeaven(true))).toBe(true);
    expect(Rod.of(5).equals(Rod.of(6))).toBe(false);
    expect(Rod.of(5).equals(Rod.of(0))).toBe(false);
  });
});

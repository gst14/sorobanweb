import { describe, expect, it } from 'vitest';
import { RodMapper } from './RodMapper';

// 7 varillas de 0,1 de ancho entre x = 0,15 y x = 0,85.
const cal = { left: 0.15, right: 0.85, beamY: 0.4, beadHeight: 0.05, rodCount: 7 };
const W = 0.1;
/** Centro de la columna c desde la izquierda. */
const col = (c: number) => cal.left + (c + 0.5) * W;

describe('RodMapper', () => {
  it('la varilla 0 es la de la derecha', () => {
    const m = new RodMapper(cal);
    expect(m.update(col(6))).toBe(0);
    m.reset();
    expect(m.update(col(0))).toBe(6);
  });

  it('un temblor de ±10 % sobre el borde no cambia de varilla', () => {
    const m = new RodMapper(cal);
    const edge = cal.left + 3 * W; // borde entre las columnas 2 y 3
    expect(m.update(edge - 0.05 * W)).toBe(4);
    for (const dx of [0.1, -0.1, 0.1, -0.05, 0.1]) expect(m.update(edge + dx * W)).toBe(4);
  });

  it('un cruce del 20 % sí cambia', () => {
    const m = new RodMapper(cal);
    const edge = cal.left + 3 * W;
    m.update(edge - 0.05 * W);
    expect(m.update(edge + 0.2 * W)).toBe(3);
  });

  it('fuera del ROI no hay varilla, salvo dentro de la histéresis de la actual', () => {
    const m = new RodMapper(cal);
    expect(m.update(0.05)).toBeNull();
    expect(m.update(0.95)).toBeNull();
    expect(m.update(col(6))).toBe(0);
    expect(m.update(cal.right + 0.1 * W)).toBe(0);
    expect(m.update(cal.right + 0.2 * W)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { EARTH_SLOTS } from '@/domain';
import { type Box, computeLayout, touchTargetPx } from './geometry';

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('computeLayout', () => {
  it('la varilla 0 está a la derecha', () => {
    const layout = computeLayout(7);
    expect(layout.rodX(0)).toBeGreaterThan(layout.rodX(6));
  });

  it('áreas táctiles ≥ 44 px con 7 varillas a 360 px de ancho', () => {
    expect(touchTargetPx(computeLayout(7), 360)).toBeGreaterThanOrEqual(44);
  });

  it('con 13 varillas a 740 px y 17 a 1000 px también llegan a 44 px', () => {
    expect(touchTargetPx(computeLayout(13), 740)).toBeGreaterThanOrEqual(44);
    expect(touchTargetPx(computeLayout(17), 1000)).toBeGreaterThanOrEqual(44);
  });

  it('el cielo queda sobre la viga y la tierra debajo', () => {
    const layout = computeLayout(7);
    const beamBottom = layout.beam.y + layout.beam.height;
    for (const down of [true, false]) {
      const h = layout.heavenCell(0, down);
      expect(h.y + h.height).toBeLessThanOrEqual(layout.beam.y);
    }
    expect(layout.heavenCell(0, true).y + layout.pitchY).toBe(layout.beam.y);
    expect(layout.earthCell(0, 0, true).y).toBe(beamBottom);
    expect(layout.earthCell(0, 3, false).y + layout.pitchY).toBeLessThanOrEqual(layout.height);
  });

  it('para cualquier cantidad de cuentas activas, las celdas de tierra no se superponen', () => {
    const layout = computeLayout(3);
    for (let earth = 0; earth <= 4; earth++) {
      const cells = EARTH_SLOTS.map((slot) => layout.earthCell(1, slot, slot < earth));
      for (let i = 0; i < cells.length; i++) {
        for (let j = i + 1; j < cells.length; j++) {
          const [a, b] = [cells[i], cells[j]];
          if (a && b) expect(overlaps(a, b)).toBe(false);
        }
      }
    }
  });

  it('puntos de unidad cada 3 varillas desde la de unidades', () => {
    expect(computeLayout(7).unitDots).toEqual([0, 3, 6]);
    expect(computeLayout(13, 1).unitDots).toEqual([1, 4, 7, 10]);
  });
});

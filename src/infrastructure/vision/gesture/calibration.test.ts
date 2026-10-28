import { describe, expect, it } from 'vitest';
import { type Digit, EARTH_SLOTS, Rod } from '@/domain';
import { beadUnits, earthCenter, heavenCenter, hitBead } from './calibration';

const DIGITS: readonly Digit[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

describe('beadUnits', () => {
  it('mide desde la viga en alturas de cuenta', () => {
    const cal = { left: 0.1, right: 0.9, beamY: 0.4, beadHeight: 0.05, rodCount: 7 };
    expect(beadUnits(cal, 0.4)).toBe(0);
    expect(beadUnits(cal, 0.5)).toBeCloseTo(2);
    expect(beadUnits(cal, 0.35)).toBeCloseTo(-1);
  });
});

describe('hitBead', () => {
  it.each(DIGITS)('con la varilla en %i encuentra cada cuenta en su centro', (d) => {
    const rod = Rod.of(d);
    expect(hitBead(rod, -heavenCenter(rod))).toEqual({ deck: 'heaven', slot: 0 });
    for (const slot of EARTH_SLOTS) {
      expect(hitBead(rod, earthCenter(rod, slot))).toEqual({ deck: 'earth', slot });
    }
  });

  it('las activas tocan la viga y las inactivas quedan tras el hueco', () => {
    const rod = Rod.of(7); // cielo activo, 2 de tierra activas
    expect(heavenCenter(rod)).toBe(0.5);
    expect(heavenCenter(Rod.of(2))).toBe(1.5);
    expect(EARTH_SLOTS.map((s) => earthCenter(rod, s))).toEqual([0.5, 1.5, 3.5, 4.5]);
  });

  it('fuera de las secciones no hay cuenta', () => {
    const rod = Rod.of(0);
    expect(hitBead(rod, -2.5)).toEqual({ deck: 'heaven', slot: 0 });
    expect(hitBead(rod, -2.6)).toBeNull();
    expect(hitBead(rod, 5.5)).toEqual({ deck: 'earth', slot: 3 });
    expect(hitBead(rod, 5.6)).toBeNull();
  });
});

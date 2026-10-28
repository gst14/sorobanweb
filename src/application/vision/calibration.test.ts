import { describe, expect, it } from 'vitest';
import {
  EARTH_TRACK,
  HEAVEN_TRACK,
  TRACK_MARGIN,
  beadUnits,
  deckAt,
  defaultCalibration,
  orientationOf,
  rodAt,
  withRods,
} from './calibration';

const CAL = { left: 0.1, right: 0.8, beamY: 0.4, beadHeight: 0.05, rodCount: 7 };

describe('beadUnits', () => {
  it('mide desde la viga en alturas de cuenta', () => {
    expect(beadUnits(CAL, 0.4)).toBe(0);
    expect(beadUnits(CAL, 0.5)).toBeCloseTo(2);
    expect(beadUnits(CAL, 0.35)).toBeCloseTo(-1);
  });
});

describe('deckAt', () => {
  it('arriba de la viga es cielo y abajo es tierra, con el margen incluido', () => {
    expect(deckAt(-0.1)).toBe('heaven');
    expect(deckAt(-(HEAVEN_TRACK + TRACK_MARGIN))).toBe('heaven');
    expect(deckAt(0)).toBe('earth');
    expect(deckAt(EARTH_TRACK + TRACK_MARGIN)).toBe('earth');
  });

  it('fuera de los recorridos no hay sección', () => {
    expect(deckAt(-(HEAVEN_TRACK + TRACK_MARGIN) - 0.01)).toBeNull();
    expect(deckAt(EARTH_TRACK + TRACK_MARGIN + 0.01)).toBeNull();
  });
});

describe('rodAt', () => {
  it('cuenta las varillas desde la derecha', () => {
    expect(rodAt(CAL, 0.79)).toBe(0);
    expect(rodAt(CAL, 0.11)).toBe(6);
    expect(rodAt(CAL, 0.45)).toBe(3);
  });

  it('fuera del ROI devuelve null', () => {
    expect(rodAt(CAL, 0.09)).toBeNull();
    expect(rodAt(CAL, 0.8)).toBeNull();
  });
});

describe('defaultCalibration', () => {
  it('es un recuadro centrado con la cantidad de varillas pedida', () => {
    expect(defaultCalibration(13)).toMatchObject({ rodCount: 13, left: 0.15, right: 0.85 });
  });
});

describe('withRods', () => {
  it('agrega la cantidad de varillas sin arrastrar otros campos', () => {
    const box = { left: 0.2, right: 0.7, beamY: 0.5, beadHeight: 0.04, extra: 1 };
    expect(withRods(box, 13)).toEqual({
      left: 0.2,
      right: 0.7,
      beamY: 0.5,
      beadHeight: 0.04,
      rodCount: 13,
    });
  });
});

describe('orientationOf', () => {
  it('es vertical solo si el frame es más alto que ancho', () => {
    expect(orientationOf(540, 960)).toBe('portrait');
    expect(orientationOf(960, 540)).toBe('landscape');
    expect(orientationOf(0, 0)).toBe('landscape');
  });
});

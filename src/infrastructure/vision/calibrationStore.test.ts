import { beforeEach, describe, expect, it } from 'vitest';
import { CALIBRATION_KEY, CalibrationStore } from './calibrationStore';

const BOX = { left: 0.2, right: 0.8, beamY: 0.4, beadHeight: 0.05 };

const throwing = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
} as unknown as Storage;

describe('CalibrationStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('guarda una calibración por orientación', () => {
    const store = new CalibrationStore(localStorage);
    expect(store.load('portrait')).toBeNull();

    store.save('portrait', BOX);
    store.save('landscape', { ...BOX, left: 0.1 });
    expect(new CalibrationStore(localStorage).load('portrait')).toEqual(BOX);
    expect(store.load('landscape')).toEqual({ ...BOX, left: 0.1 });
  });

  it('guarda solo los campos de la calibración', () => {
    const store = new CalibrationStore(localStorage);
    store.save('landscape', { ...BOX, rodCount: 7 } as typeof BOX);
    expect(JSON.parse(localStorage.getItem(CALIBRATION_KEY) ?? '')).toEqual({ landscape: BOX });
  });

  it('ignora lo que no es una calibración válida', () => {
    const store = new CalibrationStore(localStorage);
    for (const raw of [
      '{no es json',
      'null',
      '{"landscape": 3}',
      '{"landscape": null}',
      JSON.stringify({ landscape: { ...BOX, left: 'x' } }),
      JSON.stringify({ landscape: { ...BOX, right: 1.5 } }),
      JSON.stringify({ landscape: { ...BOX, left: 0.9 } }),
      JSON.stringify({ landscape: { ...BOX, beadHeight: 0 } }),
      JSON.stringify({ landscape: { ...BOX, beamY: Number.NaN } }),
    ]) {
      localStorage.setItem(CALIBRATION_KEY, raw);
      expect(store.load('landscape'), raw).toBeNull();
    }
  });

  it('sin storage, o con el storage bloqueado, no lanza', () => {
    for (const storage of [undefined, throwing]) {
      const store = new CalibrationStore(storage);
      expect(() => {
        store.save('portrait', BOX);
      }).not.toThrow();
      expect(store.load('portrait')).toBeNull();
    }
  });
});

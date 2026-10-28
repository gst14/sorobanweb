import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/application/ports';
import { EARTH_TRACK, HEAVEN_TRACK } from './calibration';
import { CalibrationCapture } from './calibrationCapture';
import { hand } from './testing/hands';

const FRAME_MS = 33;

/** Sostiene el índice en `index` durante `ms`, un frame cada 33 ms, desde `t0`. Devuelve el fin. */
function holdAt(
  capture: CalibrationCapture,
  index: Landmark,
  { t0 = 0, ms = 1000, scale = 0.2 }: { t0?: number; ms?: number; scale?: number } = {},
): number {
  let t = t0;
  for (; t <= t0 + ms + FRAME_MS; t += FRAME_MS) capture.update(hand({ t, index, scale }), t);
  return t;
}

describe('CalibrationCapture', () => {
  it('marca los dos extremos de la viga y arma la calibración', () => {
    const capture = new CalibrationCapture();
    expect(capture.step).toBe('left');

    const t = holdAt(capture, { x: 0.2, y: 0.42 });
    expect(capture.step).toBe('right');
    expect(capture.points).toHaveLength(1);
    expect(capture.points[0]?.x).toBeCloseTo(0.2);
    expect(capture.points[0]?.y).toBeCloseTo(0.42);
    expect(capture.result).toBeNull();

    holdAt(capture, { x: 0.8, y: 0.38 }, { t0: t + 500 });
    const box = capture.result;
    expect(box?.left).toBeCloseTo(0.2);
    expect(box?.right).toBeCloseTo(0.8);
    expect(box?.beamY).toBeCloseTo(0.4);
    // Mano de 0,2 → cuenta de 0,05.
    expect(box?.beadHeight).toBeCloseTo(0.05);
    expect(capture.points).toHaveLength(2);
    expect(capture.issue).toBeNull();
  });

  it('acepta los extremos en cualquier orden', () => {
    const capture = new CalibrationCapture();
    const t = holdAt(capture, { x: 0.75, y: 0.4 });
    holdAt(capture, { x: 0.3, y: 0.4 }, { t0: t });
    expect(capture.result?.left).toBeCloseTo(0.3);
    expect(capture.result?.right).toBeCloseTo(0.75);
  });

  it('el progreso crece mientras el índice está quieto y vuelve a 0 si se mueve', () => {
    const capture = new CalibrationCapture();
    capture.update(hand({ t: 0, index: { x: 0.3, y: 0.4 } }), 0);
    capture.update(hand({ t: 500, index: { x: 0.31, y: 0.4 } }), 500);
    expect(capture.progress).toBeCloseTo(0.5);

    capture.update(hand({ t: 600, index: { x: 0.4, y: 0.4 } }), 600);
    expect(capture.progress).toBe(0);
    capture.update(hand({ t: 1500, index: { x: 0.4, y: 0.4 } }), 1500);
    expect(capture.progress).toBeCloseTo(0.9);
    expect(capture.step).toBe('left');
  });

  it('sin mano la espera vuelve a empezar', () => {
    const capture = new CalibrationCapture();
    capture.update(hand({ t: 0, index: { x: 0.3, y: 0.4 } }), 0);
    capture.update(hand({ t: 900, index: { x: 0.3, y: 0.4 } }), 900);
    capture.update(null, 950);
    expect(capture.progress).toBe(0);
    capture.update(hand({ t: 1000, index: { x: 0.3, y: 0.4 } }), 1000);
    expect(capture.step).toBe('left');
    capture.update({ t: 1100, landmarks: [] }, 1100);
    expect(capture.progress).toBe(0);
  });

  it('si el segundo punto queda muy cerca del primero, lo rechaza y sigue esperando', () => {
    const capture = new CalibrationCapture();
    let t = holdAt(capture, { x: 0.4, y: 0.4 });
    t = holdAt(capture, { x: 0.55, y: 0.4 }, { t0: t });
    expect(capture.issue).toBe('too-narrow');
    expect(capture.step).toBe('right');
    expect(capture.result).toBeNull();

    holdAt(capture, { x: 0.8, y: 0.4 }, { t0: t });
    expect(capture.issue).toBeNull();
    expect(capture.result?.left).toBeCloseTo(0.4);
  });

  it('achica las cuentas para que el soroban entre en la imagen', () => {
    const high = new CalibrationCapture();
    let t = holdAt(high, { x: 0.2, y: 0.08 }, { scale: 0.3 });
    holdAt(high, { x: 0.8, y: 0.08 }, { t0: t, scale: 0.3 });
    expect(high.result?.beadHeight).toBeCloseTo(0.08 / HEAVEN_TRACK);

    const low = new CalibrationCapture();
    t = holdAt(low, { x: 0.2, y: 0.8 }, { scale: 0.3 });
    holdAt(low, { x: 0.8, y: 0.8 }, { t0: t, scale: 0.3 });
    expect(low.result?.beadHeight).toBeCloseTo(0.2 / EARTH_TRACK);
  });

  it('con la viga demasiado al borde vuelve a empezar desde el primer punto', () => {
    const capture = new CalibrationCapture();
    const t = holdAt(capture, { x: 0.2, y: 0.95 });
    holdAt(capture, { x: 0.8, y: 0.95 }, { t0: t });
    expect(capture.issue).toBe('off-frame');
    expect(capture.step).toBe('left');
    expect(capture.points).toEqual([]);
    expect(capture.result).toBeNull();
  });

  it('sin tamaño de mano usa el alto de cuenta por defecto', () => {
    const capture = new CalibrationCapture({ holdMs: 100 });
    // Solo hasta el índice (landmark 8): falta el MCP del medio.
    const partial = (t: number, x: number) => ({
      t,
      landmarks: hand({ index: { x, y: 0.4 } }).landmarks.slice(0, 9),
    });
    for (const t of [0, 50, 100]) capture.update(partial(t, 0.2), t);
    for (const t of [200, 250, 300]) capture.update(partial(t, 0.8), t);
    expect(capture.result?.beadHeight).toBeCloseTo(0.05);
  });

  it('una vez terminada ignora los frames, y restart vuelve al principio', () => {
    const capture = new CalibrationCapture();
    const t = holdAt(capture, { x: 0.2, y: 0.4 });
    holdAt(capture, { x: 0.8, y: 0.4 }, { t0: t });
    const box = capture.result;
    holdAt(capture, { x: 0.5, y: 0.5 }, { t0: 5000 });
    expect(capture.result).toBe(box);

    capture.restart();
    expect(capture.result).toBeNull();
    expect(capture.step).toBe('left');
    expect(capture.points).toEqual([]);
    expect(capture.progress).toBe(0);
  });
});

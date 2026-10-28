import { describe, expect, it } from 'vitest';
import type { TrackedHand } from '@/application/ports';
import { type QualityReading, QualityMeter } from './quality';

const withScore = (t: number, score: number): TrackedHand => ({ t, landmarks: [], score });

/** Alimenta frames cada `1000 / fps` ms desde `t0` hasta `t1` (inclusive) y devuelve la última lectura. */
function feed(
  meter: QualityMeter,
  { fps, from, to, score }: { fps: number; from: number; to: number; score?: number },
): QualityReading {
  const step = 1000 / fps;
  let reading: QualityReading | null = null;
  for (let t = from; t <= to; t += step) {
    reading = meter.update(score === undefined ? null : withScore(t, score), t);
  }
  if (!reading) throw new Error('Sin frames');
  return reading;
}

describe('QualityMeter', () => {
  it('no da nivel hasta tener medio segundo de frames', () => {
    const meter = new QualityMeter();
    expect(meter.update(null, 0)).toEqual({
      level: null,
      fps: null,
      score: null,
      suggestTouch: false,
    });
    expect(feed(meter, { fps: 30, from: 0, to: 400 }).level).toBeNull();
    expect(feed(meter, { fps: 30, from: 500, to: 600 }).level).toBe('good');
  });

  it('mide los FPS sobre el último segundo', () => {
    const meter = new QualityMeter();
    expect(feed(meter, { fps: 30, from: 0, to: 2000 }).fps).toBeCloseTo(30, 0);
    // Después de bajar a 10 fps, el segundo anterior deja de contar.
    expect(feed(meter, { fps: 10, from: 2100, to: 4000 }).fps).toBeCloseTo(10, 0);
  });

  it.each<[number, string]>([
    [30, 'good'],
    [20, 'good'],
    [15, 'fair'],
    [12, 'fair'],
    [8, 'poor'],
  ])('a %i fps y sin mano, el nivel es %s', (fps, level) => {
    expect(feed(new QualityMeter(), { fps, from: 0, to: 2000 }).level).toBe(level);
  });

  it('con mano, el nivel es el peor entre los FPS y la confianza', () => {
    const good = feed(new QualityMeter(), { fps: 30, from: 0, to: 2000, score: 0.95 });
    expect(good.level).toBe('good');
    expect(good.score).toBeCloseTo(0.95);
    expect(feed(new QualityMeter(), { fps: 30, from: 0, to: 2000, score: 0.6 }).level).toBe('fair');
    expect(feed(new QualityMeter(), { fps: 30, from: 0, to: 2000, score: 0.3 }).level).toBe('poor');
    expect(feed(new QualityMeter(), { fps: 15, from: 0, to: 2000, score: 0.95 }).level).toBe(
      'fair',
    );
  });

  it('la confianza promedia solo los frames con mano', () => {
    const meter = new QualityMeter();
    meter.update(withScore(0, 0.6), 0);
    meter.update(null, 300);
    expect(meter.update(withScore(600, 1), 600).score).toBeCloseTo(0.8);
  });

  it('sugiere táctil después de 3 s seguidos en rojo', () => {
    const meter = new QualityMeter();
    // A 5 fps hay nivel desde los 600 ms: el rojo arranca ahí.
    expect(feed(meter, { fps: 5, from: 0, to: 3400 }).suggestTouch).toBe(false);
    expect(feed(meter, { fps: 5, from: 3600, to: 3600 }).suggestTouch).toBe(true);
  });

  it('un tramo fuera del rojo reinicia la cuenta', () => {
    const meter = new QualityMeter();
    feed(meter, { fps: 5, from: 0, to: 2600 });
    // Un segundo a 30 fps sube el nivel y corta el rojo.
    expect(feed(meter, { fps: 30, from: 2633, to: 3600 }).level).not.toBe('poor');
    expect(feed(meter, { fps: 5, from: 3800, to: 6000 }).suggestTouch).toBe(false);
  });

  it('reset empieza de cero', () => {
    const meter = new QualityMeter({ poorHoldMs: 1000 });
    expect(feed(meter, { fps: 5, from: 0, to: 2000 }).suggestTouch).toBe(true);
    meter.reset();
    expect(meter.update(null, 2200)).toMatchObject({ level: null, suggestTouch: false });
  });
});

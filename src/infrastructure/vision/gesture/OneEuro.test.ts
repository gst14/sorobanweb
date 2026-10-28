import { describe, expect, it } from 'vitest';
import { OneEuro, OneEuro2D } from './OneEuro';

const FRAME_MS = 1000 / 30;

/** Ruido determinista en [-1, 1] (LCG), para no depender de Math.random. */
function noise(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return (s / 2 ** 32) * 2 - 1;
  };
}

const variance = (xs: readonly number[]): number => {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
};

describe('OneEuro', () => {
  it('una señal constante sale igual', () => {
    const f = new OneEuro();
    for (let i = 0; i < 30; i++) expect(f.filter(0.5, i * FRAME_MS)).toBeCloseTo(0.5, 12);
  });

  it('reduce el temblor en reposo', () => {
    const f = new OneEuro({ minCutoff: 1, beta: 0 });
    const rand = noise(7);
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = 0.5 + 0.01 * rand();
      raw.push(x);
      out.push(f.filter(x, i * FRAME_MS));
    }
    expect(variance(out.slice(30))).toBeLessThan(variance(raw.slice(30)) / 4);
  });

  it('con beta > 0 sigue un escalón con menos retraso', () => {
    const lag = (beta: number): number => {
      const f = new OneEuro({ minCutoff: 1, beta });
      for (let i = 0; i < 10; i++) f.filter(0, i * FRAME_MS);
      let y = 0;
      for (let i = 10; i < 15; i++) y = f.filter(1, i * FRAME_MS);
      return 1 - y;
    };
    expect(lag(5)).toBeLessThan(lag(0));
  });

  it('tolera timestamps repetidos y se puede reiniciar', () => {
    const f = new OneEuro();
    f.filter(0, 100);
    expect(Number.isFinite(f.filter(1, 100))).toBe(true);
    f.reset();
    expect(f.filter(0.8, 200)).toBe(0.8);
  });
});

describe('OneEuro2D', () => {
  it('filtra cada eje por separado y se reinicia', () => {
    const f = new OneEuro2D();
    expect(f.filter({ x: 0.2, y: 0.7 }, 0)).toEqual({ x: 0.2, y: 0.7 });
    const p = f.filter({ x: 0.4, y: 0.7 }, FRAME_MS);
    expect(p.x).toBeGreaterThan(0.2);
    expect(p.x).toBeLessThan(0.4);
    expect(p.y).toBeCloseTo(0.7, 12);
    f.reset();
    expect(f.filter({ x: 0.9, y: 0.1 }, 2 * FRAME_MS)).toEqual({ x: 0.9, y: 0.1 });
  });
});

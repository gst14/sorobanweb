import { describe, expect, it } from 'vitest';
import { createRng } from './Rng';

describe('createRng', () => {
  it('misma semilla, misma secuencia', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('semillas distintas dan secuencias distintas', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('next está en [0, 1)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('int cubre todo el rango, incluidos los extremos', () => {
    const rng = createRng(3);
    const seen = new Set(Array.from({ length: 500 }, () => rng.int(1, 6)));
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rng.int(5, 5)).toBe(5);
  });

  it.each([
    [3, 1],
    [0.5, 2],
    [0, 1.5],
  ])('int(%d, %d) lanza', (min, max) => {
    expect(() => createRng(1).int(min, max)).toThrow(RangeError);
  });

  it('pick elige de la lista y lanza si está vacía', () => {
    const rng = createRng(9);
    expect(['a', 'b', 'c']).toContain(rng.pick(['a', 'b', 'c']));
    expect(() => rng.pick([])).toThrow(RangeError);
  });
});

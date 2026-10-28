import { describe, expect, it } from 'vitest';
import { distance, fingertip, handScale } from './landmarks';
import { hand } from './testing/hands';

describe('landmarks', () => {
  it('lee las puntas del pulgar y del índice', () => {
    const frame = hand({ thumb: { x: 0.1, y: 0.2 }, index: { x: 0.3, y: 0.4 } });
    expect(fingertip(frame, 'thumb')).toEqual({ x: 0.1, y: 0.2 });
    expect(fingertip(frame, 'index')).toEqual({ x: 0.3, y: 0.4 });
  });

  it('mide el tamaño de la mano', () => {
    expect(handScale(hand({ scale: 0.25 }))).toBeCloseTo(0.25);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('no lanza con frames incompletos o degenerados', () => {
    const empty = { t: 0, landmarks: [] };
    expect(fingertip(empty, 'index')).toBeNull();
    expect(handScale(empty)).toBeNull();
    expect(handScale(hand({ scale: 0 }))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { PinchDetector } from './PinchDetector';
import { pinchAt } from './testing/hands';

const feed = (detector: PinchDetector, ratios: readonly number[]) =>
  ratios.map((r, i) => detector.update(pinchAt(r, i * 33)));

describe('PinchDetector', () => {
  it('empieza tras 3 frames bajo 0,25 y termina tras 3 frames sobre 0,40', () => {
    const d = new PinchDetector();
    expect(feed(d, [0.6, 0.2, 0.2, 0.2, 0.2])).toEqual([null, null, null, 'start', null]);
    expect(d.isPinched).toBe(true);
    expect(feed(d, [0.5, 0.5, 0.5])).toEqual([null, null, 'end']);
    expect(d.isPinched).toBe(false);
  });

  it('no parpadea dentro de la banda de histéresis', () => {
    const d = new PinchDetector();
    feed(d, [0.1, 0.1, 0.1]);
    const band = Array.from({ length: 40 }, (_, i) => (i % 2 ? 0.26 : 0.39));
    expect(feed(d, band).every((e) => e === null)).toBe(true);
    expect(d.isPinched).toBe(true);
  });

  it('un frame suelto no alcanza: el debounce se reinicia', () => {
    const d = new PinchDetector();
    expect(feed(d, [0.1, 0.1, 0.6, 0.1, 0.1, 0.6]).every((e) => e === null)).toBe(true);
  });

  it('ignora frames incompletos y se puede reiniciar', () => {
    const d = new PinchDetector({ confirmFrames: 1 });
    expect(d.update({ t: 0, landmarks: [] })).toBeNull();
    expect(d.update(pinchAt(0.1))).toBe('start');
    d.reset();
    expect(d.isPinched).toBe(false);
  });
});

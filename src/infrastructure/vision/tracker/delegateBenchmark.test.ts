import { describe, expect, it } from 'vitest';
import type { FrameScheduler } from '../VisionInput';
import {
  type DelegateSample,
  MAX_RATE_DEFICIT,
  type MeasureOptions,
  STALL_FRAMES,
  benchmarkDelegates,
  chooseDelegate,
  measureDelegate,
  median,
} from './delegateBenchmark';
import type { Delegate, HandTracker, TrackedHand } from './MediaPipeHandTracker';

const HAND: TrackedHand = { t: 0, landmarks: [{ x: 0.5, y: 0.5 }], score: 0.9 };

/** rAF que corre solo y adelanta el video un frame por llamada (salvo que esté trabado). */
function setup({ stalled = false } = {}) {
  const state = { currentTime: 0, clock: 0 };
  const video = document.createElement('video');
  Object.defineProperty(video, 'currentTime', { get: () => state.currentTime });
  const scheduler: FrameScheduler = {
    request: (callback) => {
      if (!stalled) state.currentTime += 1 / 30;
      queueMicrotask(() => {
        callback(state.clock);
      });
      return 0;
    },
    cancel: () => undefined,
  };
  return { video, scheduler, state };
}

interface TrackerSpec {
  /** ms que "tarda" cada detect. */
  readonly ms: number;
  /** Qué frames (índice desde 0, calentamiento incluido) traen mano. */
  readonly hasHand?: (i: number) => boolean;
  readonly throwAt?: number;
}

function fakeLoad(specs: Partial<Record<Delegate, TrackerSpec | Error>>, state: { clock: number }) {
  const closed: Delegate[] = [];
  const load = (delegate: Delegate): Promise<HandTracker> => {
    const spec = specs[delegate];
    if (!spec || spec instanceof Error) return Promise.reject(spec ?? new Error('sin spec'));
    let i = 0;
    return Promise.resolve({
      delegate,
      detect: () => {
        if (i === spec.throwAt) throw new Error('detect falló');
        state.clock += spec.ms;
        return (spec.hasHand ?? (() => true))(i++) ? HAND : null;
      },
      close: () => {
        closed.push(delegate);
      },
    });
  };
  return { load, closed };
}

function options(
  specs: Partial<Record<Delegate, TrackerSpec | Error>>,
  extra: Partial<MeasureOptions> = {},
  stalled = false,
) {
  const { video, scheduler, state } = setup({ stalled });
  const { load, closed } = fakeLoad(specs, state);
  const opts: MeasureOptions = { load, video, scheduler, now: () => state.clock, ...extra };
  return { opts, closed };
}

const sample = (delegate: Delegate, over: Partial<DelegateSample> = {}): DelegateSample => ({
  delegate,
  ok: true,
  frames: 30,
  detections: 30,
  medianMs: 20,
  ...over,
});

describe('median', () => {
  it('impar, par y vacío', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBe(Infinity);
  });
});

describe('measureDelegate', () => {
  it('mide hasta 30 frames con mano, sin contar el calentamiento, y cierra el tracker', async () => {
    const { opts, closed } = options({ GPU: { ms: 12 } });
    const s = await measureDelegate('GPU', opts);
    expect(s).toEqual({ delegate: 'GPU', ok: true, frames: 30, detections: 30, medianMs: 12 });
    expect(closed).toEqual(['GPU']);
  });

  it('sin mano, para en maxFrames', async () => {
    const { opts } = options({ CPU: { ms: 30, hasHand: () => false } }, { maxFrames: 40 });
    const s = await measureDelegate('CPU', opts);
    expect(s.frames).toBe(40);
    expect(s.detections).toBe(0);
  });

  it('cuenta la tasa de detección cuando la mano aparece a medias', async () => {
    const { opts } = options({ CPU: { ms: 30, hasHand: (i) => i % 2 === 0 } }, { warmupFrames: 0 });
    const s = await measureDelegate('CPU', opts);
    expect(s.detections).toBe(30);
    expect(s.frames).toBe(59);
  });

  it('un delegado que no carga da ok: false', async () => {
    const { opts, closed } = options({ GPU: new Error('sin WebGL2') });
    const s = await measureDelegate('GPU', opts);
    expect(s).toMatchObject({ ok: false, frames: 0, medianMs: Infinity });
    expect(closed).toEqual([]);
  });

  it('un detect que lanza da ok: false y cierra el tracker', async () => {
    const { opts, closed } = options({ GPU: { ms: 10, throwAt: 7 } });
    expect((await measureDelegate('GPU', opts)).ok).toBe(false);
    expect(closed).toEqual(['GPU']);
  });

  it('un video trabado da ok: false', async () => {
    const { opts, closed } = options({ CPU: { ms: 10 } }, {}, true);
    expect((await measureDelegate('CPU', opts)).ok).toBe(false);
    expect(closed).toEqual(['CPU']);
    expect(STALL_FRAMES).toBeGreaterThan(30);
  });
});

describe('chooseDelegate', () => {
  it('elige el más rápido, y la GPU ante un empate', () => {
    expect(chooseDelegate(sample('GPU', { medianMs: 10 }), sample('CPU', { medianMs: 25 }))).toBe(
      'GPU',
    );
    expect(chooseDelegate(sample('GPU', { medianMs: 30 }), sample('CPU', { medianMs: 25 }))).toBe(
      'CPU',
    );
    expect(chooseDelegate(sample('GPU'), sample('CPU'))).toBe('GPU');
  });

  it('descarta una GPU rápida que detecta bastante menos', () => {
    const cpu = sample('CPU', { frames: 30, detections: 30, medianMs: 40 });
    const bad = Math.floor(30 * (1 - MAX_RATE_DEFICIT)) - 1;
    expect(chooseDelegate(sample('GPU', { frames: 30, detections: bad, medianMs: 5 }), cpu)).toBe(
      'CPU',
    );
    expect(chooseDelegate(sample('GPU', { frames: 30, detections: 27, medianMs: 5 }), cpu)).toBe(
      'GPU',
    );
  });

  it('sin frames medidos la tasa es 0', () => {
    expect(chooseDelegate(sample('GPU', { frames: 0, detections: 0 }), sample('CPU'))).toBe('CPU');
  });

  it('si uno no anda, el otro; si ninguno, null', () => {
    const down = (d: Delegate) => sample(d, { ok: false });
    expect(chooseDelegate(down('GPU'), sample('CPU'))).toBe('CPU');
    expect(chooseDelegate(sample('GPU'), down('CPU'))).toBe('GPU');
    expect(chooseDelegate(down('GPU'), down('CPU'))).toBeNull();
  });
});

describe('benchmarkDelegates', () => {
  it('mide GPU y después CPU, de a una, y elige', async () => {
    const { opts, closed } = options({ GPU: { ms: 8 }, CPU: { ms: 30 } });
    const result = await benchmarkDelegates(opts);
    expect(result.delegate).toBe('GPU');
    expect([result.gpu.medianMs, result.cpu.medianMs]).toEqual([8, 30]);
    expect(closed).toEqual(['GPU', 'CPU']);
  });
});

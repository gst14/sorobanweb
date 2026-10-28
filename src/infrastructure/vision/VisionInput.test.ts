import { describe, expect, it } from 'vitest';
import { type Move, Soroban } from '@/domain';
import type { HandFrame } from './gesture/landmarks';
import { hand } from './gesture/testing/hands';
import { CAL, stroke } from './gesture/testing/strokes';
import type { HandTracker, TrackedHand } from './tracker/MediaPipeHandTracker';
import { type FrameScheduler, VisionInput, type VisionInputOptions } from './VisionInput';

/** rAF manual: `frame(t)` corre el callback pendiente. */
class ManualScheduler implements FrameScheduler {
  private pending = new Map<number, (t: number) => void>();
  private nextId = 1;
  request(callback: (t: number) => void): number {
    const id = this.nextId++;
    this.pending.set(id, callback);
    return id;
  }
  cancel(id: number): void {
    this.pending.delete(id);
  }
  get size(): number {
    return this.pending.size;
  }
  frame(t: number): void {
    const callbacks = [...this.pending.values()];
    this.pending.clear();
    for (const callback of callbacks) callback(t);
  }
}

/** Devuelve, en orden, los frames de la cola (null = sin mano). */
class FakeTracker implements HandTracker {
  readonly delegate = 'CPU';
  readonly calls: number[] = [];
  queue: (HandFrame | null)[] = [];
  error: Error | null = null;
  closed = false;
  detect(_video: HTMLVideoElement, t: number): TrackedHand | null {
    if (this.error) throw this.error;
    this.calls.push(t);
    const frame = this.queue.shift() ?? null;
    return frame && { ...frame, t, score: 0.9 };
  }
  close(): void {
    this.closed = true;
  }
}

function fakeVideo() {
  const video = document.createElement('video');
  const state = { currentTime: 0, readyState: 4 };
  Object.defineProperty(video, 'currentTime', { get: () => state.currentTime });
  Object.defineProperty(video, 'readyState', { get: () => state.readyState });
  return { video, state };
}

function setup(overrides: Partial<VisionInputOptions> = {}) {
  const scheduler = new ManualScheduler();
  const tracker = new FakeTracker();
  const { video, state } = fakeVideo();
  const camera = {
    width: 960,
    height: 540,
    stops: 0,
    stop() {
      this.stops++;
    },
  };
  let soroban = Soroban.create(7);
  const moves: Move[] = [];
  const frames: (TrackedHand | null)[] = [];
  const input = new VisionInput({
    video,
    camera,
    tracker,
    mode: 'push',
    calibration: CAL,
    getSoroban: () => soroban,
    onFrame: (h) => frames.push(h),
    scheduler,
    ...overrides,
  });
  const onMove = (move: Move) => {
    moves.push(move);
    soroban = soroban.apply(move);
  };
  /** Avanza un frame de video y un rAF. */
  const step = (t: number) => {
    state.currentTime = t / 1000;
    scheduler.frame(t);
  };
  return {
    input,
    scheduler,
    tracker,
    state,
    camera,
    moves,
    frames,
    onMove,
    step,
    soroban: () => soroban,
  };
}

describe('VisionInput', () => {
  it('es una entrada de tipo vision y arranca en el modo pedido', () => {
    const { input } = setup({ mode: 'pinch' });
    expect(input.kind).toBe('vision');
    expect(input.mode).toBe('pinch');
  });

  it('un trazo del pulgar frente a la cámara sube una cuenta de tierra', () => {
    const { input, tracker, onMove, step, moves, soroban } = setup();
    const samples = stroke(CAL, { rod: 0, from: 1.5, to: 0.5 });
    tracker.queue = samples.map((s) => hand({ thumb: { x: s.x, y: s.y }, index: { x: 0, y: 0 } }));
    input.start(onMove);
    for (const s of samples) step(s.t + 1);
    expect(moves.map((m) => [m.finger, m.deck, m.delta])).toEqual([['thumb', 'earth', 1]]);
    expect(soroban().toNumber()).toBe(1);
  });

  it('solo detecta cuando el video avanzó a un frame nuevo', () => {
    const { input, tracker, state, scheduler, onMove, frames } = setup();
    input.start(onMove);
    state.currentTime = 0.1;
    scheduler.frame(100);
    scheduler.frame(116); // mismo frame de video: rAF a 60 Hz con cámara a 30 fps
    state.currentTime = 0.133;
    scheduler.frame(133);
    expect(tracker.calls).toEqual([100, 133]);
    expect(frames).toEqual([null, null]);
  });

  it('no detecta mientras el video no tiene datos', () => {
    const { input, tracker, state, onMove, step } = setup();
    state.readyState = 1;
    input.start(onMove);
    step(100);
    expect(tracker.calls).toEqual([]);
  });

  it('start dos veces no duplica el bucle', () => {
    const { input, scheduler, onMove } = setup();
    input.start(onMove);
    input.start(onMove);
    expect(scheduler.size).toBe(1);
  });

  it('stop cancela el rAF, apaga la cámara y cierra el tracker, una sola vez', () => {
    const { input, scheduler, tracker, camera, onMove, step } = setup();
    input.start(onMove);
    step(100);
    input.stop();
    input.stop();
    expect(scheduler.size).toBe(0);
    expect(camera.stops).toBe(1);
    expect(tracker.closed).toBe(true);
    expect(() => {
      input.start(onMove);
    }).toThrow('ya se detuvo');
  });

  it('stop antes de start igual libera la cámara', () => {
    const { input, camera } = setup();
    input.stop();
    expect(camera.stops).toBe(1);
  });

  it('si el tracker falla, se detiene y avisa', () => {
    const errors: unknown[] = [];
    const { input, tracker, scheduler, camera, onMove, step } = setup({
      onError: (e) => errors.push(e),
    });
    tracker.error = new Error('context lost');
    input.start(onMove);
    step(100);
    expect(errors).toEqual([tracker.error]);
    expect(scheduler.size).toBe(0);
    expect(camera.stops).toBe(1);
  });

  it('si el tracker falla sin onError, igual se detiene', () => {
    const { input, tracker, scheduler, onMove, step } = setup();
    tracker.error = new Error('context lost');
    input.start(onMove);
    step(100);
    expect(scheduler.size).toBe(0);
  });

  it('setMode y setCalibration cambian el motor sin reabrir la cámara', () => {
    const { input, camera } = setup();
    input.setMode('pinch');
    expect(input.mode).toBe('pinch');
    expect(input.calibration).toBe(CAL);
    input.setCalibration({ ...CAL, rodCount: 13 });
    expect(input.mode).toBe('pinch');
    expect(input.calibration.rodCount).toBe(13);
    expect(camera.stops).toBe(0);
  });

  it('usa requestAnimationFrame si no se inyecta un scheduler', () => {
    const { video } = fakeVideo();
    const input = new VisionInput({
      video,
      camera: { width: 0, height: 0, stop: () => undefined },
      tracker: new FakeTracker(),
      mode: 'push',
      calibration: CAL,
      getSoroban: () => Soroban.create(7),
    });
    input.start(() => undefined);
    input.stop();
    expect(input.kind).toBe('vision');
  });
});

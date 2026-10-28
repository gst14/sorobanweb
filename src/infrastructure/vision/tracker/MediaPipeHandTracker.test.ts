import type { HandLandmarkerOptions } from '@mediapipe/tasks-vision';
import { describe, expect, it } from 'vitest';
import type { Landmark } from '@/application/vision';
import {
  type HandLandmarkerLike,
  type HandResultLike,
  MODEL_PATH,
  MediaPipeHandTracker,
  type VisionModule,
  WASM_DIR,
  type WasmFileset,
  loadHandTracker,
  toTrackedHand,
} from './MediaPipeHandTracker';

const hand = (n = 21) => Array.from({ length: n }, (_, i) => ({ x: i / 40, y: 0.5, z: -i }));

const result = (landmarks: Landmark[][] = [hand()], score = 0.9): HandResultLike => ({
  landmarks,
  handedness: landmarks.map(() => [{ score }]),
});

class FakeLandmarker implements HandLandmarkerLike {
  readonly timestamps: number[] = [];
  closed = false;
  next: HandResultLike = result();
  detectForVideo(_video: HTMLVideoElement, timestamp: number): HandResultLike {
    this.timestamps.push(timestamp);
    return this.next;
  }
  close(): void {
    this.closed = true;
  }
}

const video = document.createElement('video');

describe('toTrackedHand', () => {
  it('espeja x y conserva y, z, el instante y el score', () => {
    const tracked = toTrackedHand(result([[{ x: 0.2, y: 0.3, z: 0.1 }]], 0.8), 42);
    expect(tracked).toEqual({ t: 42, landmarks: [{ x: 0.8, y: 0.3, z: 0.1 }], score: 0.8 });
  });

  it('no inventa z si MediaPipe no la trae', () => {
    const tracked = toTrackedHand(result([[{ x: 0.25, y: 0.5 }]]), 0);
    expect(tracked?.landmarks[0]).toEqual({ x: 0.75, y: 0.5 });
  });

  it('devuelve null sin mano o con una mano vacía', () => {
    expect(toTrackedHand(result([]), 0)).toBeNull();
    expect(toTrackedHand(result([[]]), 0)).toBeNull();
  });

  it('usa score 0 si falta la handedness', () => {
    expect(toTrackedHand({ landmarks: [hand()], handedness: [] }, 0)?.score).toBe(0);
  });

  it('toma solo la primera mano', () => {
    const tracked = toTrackedHand(result([hand(21), hand(3)]), 0);
    expect(tracked?.landmarks).toHaveLength(21);
  });
});

describe('MediaPipeHandTracker', () => {
  it('pasa el frame al landmarker y devuelve la mano en espacio pantalla', () => {
    const landmarker = new FakeLandmarker();
    const tracker = new MediaPipeHandTracker(landmarker, 'CPU');
    const tracked = tracker.detect(video, 100);
    expect(landmarker.timestamps).toEqual([100]);
    expect(tracked?.t).toBe(100);
    expect(tracked?.landmarks[4]?.x).toBeCloseTo(1 - 4 / 40);
  });

  it('fuerza timestamps estrictamente crecientes, pero el frame conserva su instante', () => {
    const landmarker = new FakeLandmarker();
    const tracker = new MediaPipeHandTracker(landmarker, 'GPU');
    tracker.detect(video, 100);
    const repeated = tracker.detect(video, 100);
    tracker.detect(video, 50);
    tracker.detect(video, 200);
    expect(landmarker.timestamps).toEqual([100, 101, 102, 200]);
    expect(repeated?.t).toBe(100);
  });

  it('devuelve null cuando no hay mano', () => {
    const landmarker = new FakeLandmarker();
    landmarker.next = result([]);
    expect(new MediaPipeHandTracker(landmarker, 'CPU').detect(video, 0)).toBeNull();
  });

  it('close libera el landmarker', () => {
    const landmarker = new FakeLandmarker();
    new MediaPipeHandTracker(landmarker, 'CPU').close();
    expect(landmarker.closed).toBe(true);
  });
});

describe('loadHandTracker', () => {
  function fakeVision(createError?: Error) {
    const landmarker = new FakeLandmarker();
    const calls: { basePath?: string; options?: HandLandmarkerOptions } = {};
    const fileset: WasmFileset = { wasmLoaderPath: 'loader.js', wasmBinaryPath: 'bin.wasm' };
    const vision: VisionModule = {
      FilesetResolver: {
        forVisionTasks: (basePath) => {
          calls.basePath = basePath;
          return Promise.resolve(fileset);
        },
      },
      HandLandmarker: {
        createFromOptions: (fs, options) => {
          expect(fs).toBe(fileset);
          calls.options = options;
          return createError ? Promise.reject(createError) : Promise.resolve(landmarker);
        },
      },
    };
    return { vision, calls, landmarker };
  }

  it('carga WASM y modelo del mismo origen, en modo VIDEO con una mano', async () => {
    const { vision, calls, landmarker } = fakeVision();
    const tracker = await loadHandTracker({
      delegate: 'GPU',
      baseUrl: '/app/',
      importVision: () => Promise.resolve(vision),
    });
    expect(calls.basePath).toBe(`/app/${WASM_DIR}`);
    expect(calls.options).toEqual({
      baseOptions: { modelAssetPath: `/app/${MODEL_PATH}`, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
    expect(tracker.delegate).toBe('GPU');
    tracker.close();
    expect(landmarker.closed).toBe(true);
  });

  it('usa la base de Vite por defecto', async () => {
    const { vision, calls } = fakeVision();
    await loadHandTracker({ delegate: 'CPU', importVision: () => Promise.resolve(vision) });
    expect(calls.basePath).toBe('/mediapipe/wasm');
    expect(calls.options?.baseOptions?.modelAssetPath).toBe('/models/hand_landmarker.task');
  });

  it('propaga el error si el delegado no está disponible', async () => {
    const { vision } = fakeVision(new Error('WebGL2 no disponible'));
    await expect(
      loadHandTracker({ delegate: 'GPU', importVision: () => Promise.resolve(vision) }),
    ).rejects.toThrow('WebGL2');
  });
});

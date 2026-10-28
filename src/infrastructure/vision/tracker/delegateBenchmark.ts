import type { FrameScheduler } from '../VisionInput';
import type { Delegate, HandTracker } from './MediaPipeHandTracker';

/** Resultado de correr el tracker con un delegado sobre frames reales de la cámara. */
export interface DelegateSample {
  readonly delegate: Delegate;
  /** False si el delegado no cargó o falló al detectar. */
  readonly ok: boolean;
  /** Frames medidos (sin contar el calentamiento). */
  readonly frames: number;
  /** Frames medidos en los que se detectó una mano. */
  readonly detections: number;
  /** Mediana de la latencia de `detect`, en ms. */
  readonly medianMs: number;
  /** Por qué falló: no cargó, `detect` lanzó, o el video dejó de avanzar (cámara trabada). */
  readonly failure?: 'load' | 'detect' | 'stalled';
}

export interface BenchmarkVideo {
  readonly currentTime: number;
}

export interface MeasureOptions {
  readonly load: (delegate: Delegate) => Promise<HandTracker>;
  readonly video: HTMLVideoElement;
  readonly scheduler: FrameScheduler;
  readonly now: () => number;
  /** Se mide hasta juntar esta cantidad de frames con mano (§4.1: 30). */
  readonly targetDetections?: number;
  /** Tope de frames medidos, por si la mano no aparece. */
  readonly maxFrames?: number;
  /** Frames iniciales que no se miden: el delegado GPU compila shaders en los primeros. */
  readonly warmupFrames?: number;
}

/** Si la GPU detecta bastante menos que la CPU, está dando resultados erróneos. */
export const MAX_RATE_DEFICIT = 0.15;

const failed = (delegate: Delegate, failure: DelegateSample['failure']): DelegateSample => ({
  delegate,
  ok: false,
  frames: 0,
  detections: 0,
  medianMs: Infinity,
  ...(failure ? { failure } : {}),
});

export function median(values: readonly number[]): number {
  if (values.length === 0) return Infinity;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? Infinity)
    : ((sorted[mid - 1] ?? Infinity) + (sorted[mid] ?? Infinity)) / 2;
}

/** El video dejó de entregar frames: es la cámara, no el delegado. */
export class VideoStalledError extends Error {
  constructor() {
    super('El video no avanza');
    this.name = 'VideoStalledError';
  }
}

/** rAFs sin un frame nuevo (unos 2 s a 60 Hz) tras los cuales el video se da por trabado. */
export const STALL_FRAMES = 120;

/** Espera al próximo rAF en el que el video avanzó a un frame nuevo; rechaza si se traba. */
function nextVideoFrame(
  video: BenchmarkVideo,
  scheduler: FrameScheduler,
  last: number,
): Promise<number> {
  return new Promise((resolve, reject) => {
    let waited = 0;
    const check = () => {
      if (video.currentTime !== last) resolve(video.currentTime);
      else if (++waited >= STALL_FRAMES) reject(new VideoStalledError());
      else scheduler.request(check);
    };
    scheduler.request(check);
  });
}

/** Carga el tracker con `delegate`, lo mide sobre frames de `video` y lo cierra. */
export async function measureDelegate(
  delegate: Delegate,
  {
    load,
    video,
    scheduler,
    now,
    targetDetections = 30,
    maxFrames = 150,
    warmupFrames = 5,
  }: MeasureOptions,
): Promise<DelegateSample> {
  let tracker: HandTracker;
  try {
    tracker = await load(delegate);
  } catch {
    return failed(delegate, 'load');
  }
  const latencies: number[] = [];
  let detections = 0;
  let videoTime = video.currentTime;
  try {
    for (let i = 0; latencies.length < maxFrames && detections < targetDetections; i++) {
      videoTime = await nextVideoFrame(video, scheduler, videoTime);
      const start = now();
      const hand = tracker.detect(video, start);
      const elapsed = now() - start;
      if (i < warmupFrames) continue;
      latencies.push(elapsed);
      if (hand) detections++;
    }
  } catch (error) {
    return failed(delegate, error instanceof VideoStalledError ? 'stalled' : 'detect');
  } finally {
    tracker.close();
  }
  return { delegate, ok: true, frames: latencies.length, detections, medianMs: median(latencies) };
}

const rate = (s: DelegateSample): number => (s.frames === 0 ? 0 : s.detections / s.frames);

/**
 * Elige el delegado: la CPU si la GPU no anda o detecta bastante menos (delegado erróneo en
 * algunos móviles); si no, el más rápido, y la GPU ante un empate. Null si ninguno anda.
 */
export function chooseDelegate(gpu: DelegateSample, cpu: DelegateSample): Delegate | null {
  if (!gpu.ok) return cpu.ok ? 'CPU' : null;
  if (!cpu.ok) return 'GPU';
  if (rate(gpu) < rate(cpu) - MAX_RATE_DEFICIT) return 'CPU';
  return gpu.medianMs <= cpu.medianMs ? 'GPU' : 'CPU';
}

/** Ningún delegado anduvo porque el video no avanzaba: hay que culpar a la cámara. */
export const cameraStalled = (result: BenchmarkResult): boolean =>
  result.delegate === null &&
  (result.gpu.failure === 'stalled' || result.cpu.failure === 'stalled');

export interface BenchmarkResult {
  readonly delegate: Delegate | null;
  readonly gpu: DelegateSample;
  readonly cpu: DelegateSample;
}

/** Mide la GPU y después la CPU (de a una, para no tener dos grafos en memoria) y elige. */
export async function benchmarkDelegates(options: MeasureOptions): Promise<BenchmarkResult> {
  const gpu = await measureDelegate('GPU', options);
  const cpu = await measureDelegate('CPU', options);
  return { delegate: chooseDelegate(gpu, cpu), gpu, cpu };
}

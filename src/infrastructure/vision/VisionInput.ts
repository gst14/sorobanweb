import type {
  CameraSession,
  Delegate,
  MoveListener,
  TraceListener,
  VisionSession,
} from '@/application/ports';
import type { Soroban } from '@/domain';
import type { Calibration } from './gesture/calibration';
import {
  type GestureEngineOptions,
  type GestureMode,
  GestureEngine,
} from './gesture/GestureEngine';
import type { HandTracker, TrackedHand } from './tracker/MediaPipeHandTracker';

/** requestAnimationFrame y su cancelación; los tests pasan un reloj manual. */
export interface FrameScheduler {
  request(callback: (t: number) => void): number;
  cancel(id: number): void;
}

export const animationFrames: FrameScheduler = {
  request: (callback) => requestAnimationFrame(callback),
  cancel: (id) => {
    cancelAnimationFrame(id);
  },
};

/** `HTMLMediaElement.HAVE_CURRENT_DATA`: hay un frame para leer. */
const HAVE_CURRENT_DATA = 2;

/** Ajustes finos del motor (huecos, filtros, umbrales); por defecto, los del bloque A. */
export type GestureTuning = Omit<GestureEngineOptions, 'mode' | 'calibration'>;

export interface VisionInputOptions {
  readonly video: HTMLVideoElement;
  readonly camera: CameraSession;
  readonly tracker: HandTracker;
  readonly mode: GestureMode;
  readonly calibration: Calibration;
  readonly getSoroban: () => Soroban;
  readonly tuning?: GestureTuning;
  /** Cada frame procesado, con o sin mano: para el overlay y el indicador de calidad. */
  readonly onFrame?: (hand: TrackedHand | null, t: number) => void;
  /** El tracker falló (por ejemplo, se perdió el contexto WebGL). La entrada ya se detuvo. */
  readonly onError?: (error: unknown) => void;
  readonly scheduler?: FrameScheduler;
}

/**
 * Entrada por cámara, fuera de React: en cada rAF, si el video avanzó a un frame nuevo, lo pasa
 * por el tracker y el motor de gestos y emite los movimientos. Es dueña de la cámara y del
 * tracker: `stop()` los libera, y la instancia no se vuelve a arrancar.
 */
export class VisionInput implements VisionSession {
  readonly kind = 'vision';
  private readonly options: VisionInputOptions;
  private readonly scheduler: FrameScheduler;
  private engine: GestureEngine;
  private currentCalibration: Calibration;
  private onMove: MoveListener | null = null;
  private onTrace: TraceListener | null = null;
  /** El motor se creó y todavía no salió en un trace. */
  private engineChanged = true;
  private frameId: number | null = null;
  private lastVideoTime = -1;
  private stopped = false;

  constructor(options: VisionInputOptions) {
    this.options = options;
    this.scheduler = options.scheduler ?? animationFrames;
    this.currentCalibration = options.calibration;
    this.engine = this.createEngine(options.mode);
  }

  get mode(): GestureMode {
    return this.engine.mode;
  }

  get calibration(): Calibration {
    return this.currentCalibration;
  }

  get delegate(): Delegate {
    return this.options.tracker.delegate;
  }

  start(onMove: MoveListener): void {
    if (this.stopped) throw new Error('VisionInput ya se detuvo');
    this.onMove = onMove;
    this.frameId ??= this.scheduler.request(this.tick);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.onMove = null;
    if (this.frameId !== null) this.scheduler.cancel(this.frameId);
    this.frameId = null;
    this.options.camera.stop();
    this.options.tracker.close();
  }

  /** Cambia de modo sin reabrir la cámara; suelta cualquier cuenta agarrada. */
  setMode(mode: GestureMode): void {
    this.engine = this.createEngine(mode);
  }

  setCalibration(calibration: Calibration): void {
    this.currentCalibration = calibration;
    this.engine = this.createEngine(this.engine.mode);
  }

  setTraceListener(listener: TraceListener | null): void {
    this.onTrace = listener;
    // Un motor nuevo, sin trazos a medias: así una grabación se reproduce igual desde el
    // primer frame. Suelta lo que estuviera agarrado, algo aceptable al empezar a grabar.
    if (listener) this.engine = this.createEngine(this.engine.mode);
  }

  private createEngine(mode: GestureMode): GestureEngine {
    this.engineChanged = true;
    return new GestureEngine({
      ...this.options.tuning,
      mode,
      calibration: this.currentCalibration,
    });
  }

  private readonly tick = (t: number): void => {
    this.frameId = this.scheduler.request(this.tick);
    const { video } = this.options;
    if (video.readyState < HAVE_CURRENT_DATA || video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;

    let hand: TrackedHand | null;
    try {
      hand = this.options.tracker.detect(video, t);
    } catch (error) {
      this.stop();
      this.options.onError?.(error);
      return;
    }
    const soroban = this.options.getSoroban();
    const moves = this.engine.update(hand, t, soroban);
    for (const move of moves) this.onMove?.(move);
    if (this.onTrace) {
      const { mode, calibration } = this;
      const engine = this.engineChanged ? { engine: { mode, calibration } } : {};
      this.engineChanged = false;
      this.onTrace({ t, hand, soroban, moves, ...engine });
    }
    this.options.onFrame?.(hand, t);
  };
}

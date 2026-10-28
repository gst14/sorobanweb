import { type Move, createRng } from '@/domain';
import { defaultCalibration } from '../vision/calibration';
import type { AudioCue, AudioPort } from '../ports/AudioPort';
import type { CameraPort, CameraResult } from '../ports/CameraPort';
import type { Clock } from '../ports/Clock';
import type { AttemptRecord, LessonResultRecord, ProgressRepo } from '../ports/ProgressRepo';
import type { RngFactory } from '../ports/RngFactory';
import type {
  Calibration,
  CalibrationBox,
  CameraOrientation,
  Delegate,
  GestureMode,
  TrackedHand,
  VisionError,
  VisionPhase,
  VisionPort,
  VisionResult,
  VisionSession,
  VisionStartOptions,
} from '../ports/VisionPort';
import type { MoveListener } from '../ports/InputSource';

export class FakeClock implements Clock {
  private t: number;
  constructor(start = 0) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

export class FakeAudio implements AudioPort {
  readonly played: AudioCue[] = [];
  unlocked = false;
  muted = false;
  unlock(): Promise<void> {
    this.unlocked = true;
    return Promise.resolve();
  }
  play(cue: AudioCue): void {
    if (!this.muted) this.played.push(cue);
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
}

export class InMemoryProgressRepo implements ProgressRepo {
  readonly attempts: AttemptRecord[] = [];
  readonly results: LessonResultRecord[] = [];
  saveAttempt(attempt: AttemptRecord): Promise<void> {
    this.attempts.push(attempt);
    return Promise.resolve();
  }
  saveLessonResult(result: LessonResultRecord): Promise<void> {
    this.results.push(result);
    return Promise.resolve();
  }
  passedLessons(): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set(this.results.filter((r) => r.passed).map((r) => r.lessonId)));
  }
}

export const seededRng: RngFactory = (seed = 1) => createRng(seed);

/** Cámara que devuelve un resultado fijo y cuenta las aperturas. */
export class FakeCamera implements CameraPort {
  opens = 0;
  stops = 0;
  result: CameraResult = {
    ok: true,
    session: {
      width: 960,
      height: 540,
      stop: () => {
        this.stops++;
      },
    },
  };
  open(): Promise<CameraResult> {
    this.opens++;
    return Promise.resolve(this.result);
  }
}

/** Sesión de cámara falsa: los tests empujan frames y fallas del tracker a mano. */
export class FakeVisionSession implements VisionSession {
  readonly kind = 'vision';
  readonly delegate: Delegate;
  mode: GestureMode;
  calibration: Calibration;
  onMove: MoveListener | null = null;
  stopped = false;
  private readonly options: VisionStartOptions;

  constructor(delegate: Delegate, options: VisionStartOptions) {
    this.delegate = delegate;
    this.mode = options.mode;
    this.calibration = options.calibration ?? defaultCalibration(options.getSoroban().rods.length);
    this.options = options;
  }
  start(onMove: MoveListener): void {
    this.onMove = onMove;
  }
  stop(): void {
    this.stopped = true;
    this.onMove = null;
  }
  setMode(mode: GestureMode): void {
    this.mode = mode;
  }
  setCalibration(calibration: Calibration): void {
    this.calibration = calibration;
  }
  /** Simula un movimiento reconocido por el motor de gestos. */
  emit(move: Move): void {
    this.onMove?.(move);
  }
  /** Simula un frame procesado por el tracker. */
  frame(hand: TrackedHand | null, t = 0): void {
    this.options.onFrame?.(hand, t);
  }
  /** Simula que el tracker se rompe en pleno uso: se detiene y avisa. */
  fail(error: unknown = new Error('tracker')): void {
    this.stop();
    this.options.onError?.(error);
  }
}

/**
 * Modo cámara falso. Con `hold()`, el próximo `start` queda esperando hasta `release()`, para
 * ver las fases intermedias o cancelar a mitad de camino.
 */
export class FakeVision implements VisionPort {
  readonly starts: VisionStartOptions[] = [];
  readonly sessions: FakeVisionSession[] = [];
  error: VisionError | null = null;
  delegate: Delegate = 'GPU';
  phases: readonly VisionPhase[] = ['camera', 'loading'];
  compat = false;
  readonly calibrations = new Map<CameraOrientation, CalibrationBox>();
  private held = false;
  private pending: (() => void) | null = null;

  start(_video: HTMLVideoElement, options: VisionStartOptions): Promise<VisionResult> {
    this.starts.push(options);
    for (const phase of this.phases) options.onPhase?.(phase);
    const finish = (): VisionResult => {
      if (options.signal?.aborted) return { ok: false, error: 'aborted' };
      if (this.error) return { ok: false, error: this.error };
      const session = new FakeVisionSession(this.compat ? 'CPU' : this.delegate, options);
      this.sessions.push(session);
      return { ok: true, session };
    };
    if (!this.held) return Promise.resolve(finish());
    return new Promise((resolve) => {
      this.pending = () => {
        resolve(finish());
      };
    });
  }
  hold(): void {
    this.held = true;
  }
  release(): void {
    this.held = false;
    this.pending?.();
    this.pending = null;
  }
  compatibilityMode(): boolean {
    return this.compat;
  }
  setCompatibilityMode(on: boolean): void {
    this.compat = on;
  }
  savedCalibration(orientation: CameraOrientation): CalibrationBox | null {
    return this.calibrations.get(orientation) ?? null;
  }
  saveCalibration(orientation: CameraOrientation, box: CalibrationBox): void {
    this.calibrations.set(orientation, box);
  }
}

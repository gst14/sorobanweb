import type {
  CameraPort,
  CameraSession,
  Delegate,
  VisionError,
  VisionPort,
  VisionResult,
  VisionStartOptions,
} from '@/application/ports';
import { defaultCalibration } from '@/application/vision';
import {
  type BenchmarkResult,
  type MeasureOptions,
  benchmarkDelegates,
  cameraStalled,
} from './tracker/delegateBenchmark';
import type { DelegatePreference } from './tracker/delegatePreference';
import { type HandTracker, loadHandTracker } from './tracker/MediaPipeHandTracker';
import {
  type FrameScheduler,
  type GestureTuning,
  VisionInput,
  animationFrames,
} from './VisionInput';

export interface VisionServiceDeps {
  readonly camera: CameraPort;
  readonly preference: DelegatePreference;
  /** Carga el tracker con un delegado; por defecto, MediaPipe del mismo origen. */
  readonly load?: (delegate: Delegate) => Promise<HandTracker>;
  /** Mide los dos delegados; por defecto, `benchmarkDelegates`. */
  readonly benchmark?: (options: MeasureOptions) => Promise<BenchmarkResult>;
  readonly scheduler?: FrameScheduler;
  readonly now?: () => number;
  readonly tuning?: GestureTuning;
}

/**
 * Arranque del modo cámara: abre la cámara, elige el delegado (el guardado o, si no hay, el
 * que gane el benchmark) y carga el tracker. Cualquier fallo libera lo que ya estaba abierto.
 */
export class VisionService implements VisionPort {
  private readonly deps: VisionServiceDeps;
  private readonly load: (delegate: Delegate) => Promise<HandTracker>;
  private readonly scheduler: FrameScheduler;

  constructor(deps: VisionServiceDeps) {
    this.deps = deps;
    this.load = deps.load ?? ((delegate) => loadHandTracker({ delegate }));
    this.scheduler = deps.scheduler ?? animationFrames;
  }

  async start(video: HTMLVideoElement, options: VisionStartOptions): Promise<VisionResult> {
    const { signal, onPhase } = options;
    if (signal?.aborted) return { ok: false, error: 'aborted' };

    onPhase?.('camera');
    const opened = await this.deps.camera.open(video);
    if (!opened.ok) return opened;
    const camera = opened.session;
    const fail = (error: VisionError): VisionResult => {
      camera.stop();
      return { ok: false, error };
    };
    if (signal?.aborted) return fail('aborted');

    const delegate = await this.chooseDelegate(video, options);
    if (signal?.aborted) return fail('aborted');
    if (delegate === 'stalled') return fail('not-readable');
    if (!delegate) return fail('tracker');

    onPhase?.('loading');
    const tracker = await this.loadWithFallback(delegate);
    if (!tracker) return fail('tracker');
    if (signal?.aborted) {
      tracker.close();
      return fail('aborted');
    }
    return { ok: true, session: this.createInput(video, camera, tracker, options) };
  }

  compatibilityMode(): boolean {
    return this.deps.preference.load()?.source === 'forced';
  }

  setCompatibilityMode(on: boolean): void {
    this.deps.preference.force(on ? 'CPU' : null);
  }

  /**
   * El delegado guardado, o el que gane el benchmark (que se guarda). Null si ninguno anda;
   * `stalled` si no anduvieron porque la cámara dejó de entregar frames.
   */
  private async chooseDelegate(
    video: HTMLVideoElement,
    { onPhase }: VisionStartOptions,
  ): Promise<Delegate | 'stalled' | null> {
    const saved = this.deps.preference.load();
    if (saved) return saved.delegate;
    onPhase?.('benchmark');
    const result = await (this.deps.benchmark ?? benchmarkDelegates)({
      load: this.load,
      video,
      scheduler: this.scheduler,
      now: this.deps.now ?? (() => performance.now()),
    });
    if (cameraStalled(result)) return 'stalled';
    return this.deps.preference.saveBenchmark(result)?.delegate ?? null;
  }

  /** Si la GPU no carga (por ejemplo, se perdió WebGL desde el benchmark), prueba la CPU. */
  private async loadWithFallback(delegate: Delegate): Promise<HandTracker | null> {
    try {
      return await this.load(delegate);
    } catch {
      if (delegate === 'CPU') return null;
    }
    try {
      return await this.load('CPU');
    } catch {
      return null;
    }
  }

  private createInput(
    video: HTMLVideoElement,
    camera: CameraSession,
    tracker: HandTracker,
    { mode, calibration, getSoroban, onFrame, onError }: VisionStartOptions,
  ): VisionInput {
    return new VisionInput({
      video,
      camera,
      tracker,
      mode,
      calibration: calibration ?? defaultCalibration(getSoroban().rods.length),
      getSoroban,
      scheduler: this.scheduler,
      ...(this.deps.tuning ? { tuning: this.deps.tuning } : {}),
      ...(onFrame ? { onFrame } : {}),
      ...(onError ? { onError } : {}),
    });
  }
}

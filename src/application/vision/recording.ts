import type { Calibration, FrameTrace, GestureMode } from '@/application/ports';
import type { Digit, Move } from '@/domain';

export const RECORDING_VERSION = 1;

/** Una mano grabada: la confianza y los landmarks como pares [x, y] (z no se usa). */
export interface RecordedHand {
  readonly score: number;
  readonly landmarks: readonly (readonly [number, number])[];
}

/** Un frame grabado. Los campos opcionales solo aparecen cuando cambian respecto del anterior. */
export interface RecordedFrame {
  readonly t: number;
  readonly hand: RecordedHand | null;
  /** Dígitos del soroban que recibió el motor (índice 0 = varilla de la derecha). */
  readonly soroban?: readonly Digit[];
  /** El motor se creó de nuevo antes de este frame, con este modo y esta calibración. */
  readonly engine?: { readonly mode: GestureMode; readonly calibration: Calibration };
  /** Movimientos esperados en este frame: los que emitió el motor al grabar, o los corregidos. */
  readonly moves?: readonly Move[];
}

/**
 * Una sesión de gestos grabada en desarrollo. Se reproduce sin cámara pasando los frames por
 * el motor de gestos, y así una prueba con una mano real queda como test de regresión.
 */
export interface SessionRecording {
  readonly version: typeof RECORDING_VERSION;
  readonly recordedAt: string;
  /** Qué se hizo frente a la cámara, para quien lea el test. */
  readonly label: string;
  readonly frames: readonly RecordedFrame[];
}

/** 2 minutos a 30 fps: unos 3 MB de JSON. */
export const MAX_RECORDED_FRAMES = 3600;

const sameDigits = (a: readonly Digit[] | null, b: readonly Digit[]): boolean =>
  a !== null && a.length === b.length && a.every((d, i) => d === b[i]);

/** Junta los traces de una sesión de visión y los arma como `SessionRecording`. */
export class SessionRecorder {
  private readonly frames: RecordedFrame[] = [];
  private readonly maxFrames: number;
  private lastDigits: readonly Digit[] | null = null;

  constructor(maxFrames = MAX_RECORDED_FRAMES) {
    this.maxFrames = maxFrames;
  }

  get frameCount(): number {
    return this.frames.length;
  }

  /** Lleno: los frames siguientes se descartan. */
  get full(): boolean {
    return this.frames.length >= this.maxFrames;
  }

  /** Duración grabada en ms. */
  get durationMs(): number {
    const first = this.frames[0];
    const last = this.frames.at(-1);
    return first && last ? last.t - first.t : 0;
  }

  /** Agrega un frame. El primero tiene que traer `engine`, si no, no se podría reproducir. */
  add({ t, hand, soroban, engine, moves }: FrameTrace): void {
    if (this.full) return;
    if (this.frames.length === 0 && !engine) {
      throw new Error('El primer frame grabado tiene que traer el modo y la calibración');
    }
    const digits = soroban.digits();
    const changed = !sameDigits(this.lastDigits, digits);
    this.lastDigits = digits;
    this.frames.push({
      t,
      hand: hand && {
        score: hand.score,
        landmarks: hand.landmarks.map((l) => [l.x, l.y] as const),
      },
      ...(changed ? { soroban: digits } : {}),
      ...(engine ? { engine: { mode: engine.mode, calibration: { ...engine.calibration } } } : {}),
      ...(moves.length > 0 ? { moves: moves.map((m) => ({ ...m })) } : {}),
    });
  }

  toRecording(label: string, recordedAt: Date): SessionRecording {
    return {
      version: RECORDING_VERSION,
      recordedAt: recordedAt.toISOString(),
      label,
      frames: [...this.frames],
    };
  }
}

/** Nombre de archivo para descargar: `gestos-push-20261028-153012.json`. */
export function recordingFileName(recording: SessionRecording): string {
  const mode = recording.frames[0]?.engine?.mode ?? 'sesion';
  const stamp = recording.recordedAt.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return `gestos-${mode}-${stamp}.json`;
}

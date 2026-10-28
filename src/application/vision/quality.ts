import type { TrackedHand } from '@/application/ports';

/** Verde, ámbar o rojo: qué tan bien anda el seguimiento de la mano en este dispositivo. */
export type QualityLevel = 'good' | 'fair' | 'poor';

export interface QualityTuning {
  /** Ventana sobre la que se miden los FPS y la confianza, en ms. */
  readonly windowMs: number;
  readonly goodFps: number;
  readonly fairFps: number;
  /** Confianza media del tracker (0..1) en los frames con mano. */
  readonly goodScore: number;
  readonly fairScore: number;
  /** Cuánto tiempo seguido en rojo hace falta para sugerir el modo táctil, en ms. */
  readonly poorHoldMs: number;
}

export const QUALITY_TUNING: QualityTuning = {
  windowMs: 1000,
  goodFps: 20,
  fairFps: 12,
  goodScore: 0.8,
  fairScore: 0.5,
  poorHoldMs: 3000,
};

export interface QualityReading {
  /** Null mientras no haya medio segundo de frames para medir. */
  readonly level: QualityLevel | null;
  readonly fps: number | null;
  /** Confianza media en la ventana; null si en la ventana no hubo mano. */
  readonly score: number | null;
  /** El nivel lleva `poorHoldMs` en rojo sin cortes. */
  readonly suggestTouch: boolean;
}

const RANK: Readonly<Record<QualityLevel, number>> = { poor: 0, fair: 1, good: 2 };

const worst = (a: QualityLevel, b: QualityLevel): QualityLevel => (RANK[a] <= RANK[b] ? a : b);

const levelOf = (value: number, good: number, fair: number): QualityLevel =>
  value >= good ? 'good' : value >= fair ? 'fair' : 'poor';

interface Sample {
  readonly t: number;
  readonly score: number | null;
}

/**
 * Indicador de calidad: con cada frame procesado mide los FPS y la confianza media del tracker
 * en el último segundo. Sin mano a la vista solo cuentan los FPS, para no castigar a quien
 * todavía no levantó la mano.
 */
export class QualityMeter {
  private readonly tuning: QualityTuning;
  private samples: Sample[] = [];
  private poorSince: number | null = null;

  constructor(tuning: Partial<QualityTuning> = {}) {
    this.tuning = { ...QUALITY_TUNING, ...tuning };
  }

  update(hand: TrackedHand | null, t: number): QualityReading {
    const { windowMs, poorHoldMs } = this.tuning;
    this.samples.push({ t, score: hand?.score ?? null });
    this.samples = this.samples.filter((s) => s.t > t - windowMs);

    const fps = this.fps(t);
    const scores = this.samples.flatMap((s) => (s.score === null ? [] : [s.score]));
    const score = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    const level = fps === null ? null : this.level(fps, score);

    if (level === 'poor') this.poorSince ??= t;
    else this.poorSince = null;
    const suggestTouch = this.poorSince !== null && t - this.poorSince >= poorHoldMs;
    return { level, fps, score, suggestTouch };
  }

  reset(): void {
    this.samples = [];
    this.poorSince = null;
  }

  /** Frames por segundo en la ventana que termina en `t` (el último frame, siempre presente). */
  private fps(t: number): number | null {
    const span = t - Math.min(...this.samples.map((s) => s.t));
    if (span < this.tuning.windowMs / 2) return null;
    return ((this.samples.length - 1) * 1000) / span;
  }

  private level(fps: number, score: number | null): QualityLevel {
    const { goodFps, fairFps, goodScore, fairScore } = this.tuning;
    const byFps = levelOf(fps, goodFps, fairFps);
    return score === null ? byFps : worst(byFps, levelOf(score, goodScore, fairScore));
  }
}

import type { CalibrationBox, HandFrame, Landmark } from '@/application/ports';
import { EARTH_TRACK, HEAVEN_TRACK, defaultCalibration } from './calibration';
import { distance, fingertip, handScale } from './landmarks';

/** Qué extremo de la viga se está marcando. */
export type CaptureStep = 'left' | 'right';

/**
 * Por qué no se aceptó el último punto: el segundo quedó muy cerca del primero, o con la viga a
 * esa altura el soroban no entra en la imagen (y se vuelve a empezar).
 */
export type CaptureIssue = 'too-narrow' | 'off-frame';

export interface CaptureTuning {
  /** Cuánto tiempo hay que sostener el índice quieto para marcar un punto, en ms. */
  readonly holdMs: number;
  /** Cuánto se puede mover el índice sin que se reinicie la espera, en unidades normalizadas. */
  readonly stillRadius: number;
  /** Ancho mínimo entre los dos extremos. */
  readonly minWidth: number;
  /** Alto de una cuenta como fracción del tamaño de la mano (muñeca → MCP del medio). */
  readonly beadPerHand: number;
  /** Alto mínimo de una cuenta; por debajo, el soroban no entra en la imagen. */
  readonly minBead: number;
}

export const CAPTURE_TUNING: CaptureTuning = {
  holdMs: 1000,
  stillRadius: 0.02,
  minWidth: 0.25,
  beadPerHand: 0.25,
  minBead: 0.02,
};

interface Mark {
  readonly point: Landmark;
  /** Tamaño medio de la mano mientras se sostuvo, si el frame lo traía. */
  readonly scale: number | null;
}

interface Hold {
  readonly start: number;
  readonly anchor: Landmark;
  x: number;
  y: number;
  count: number;
  scale: number;
  scaleCount: number;
}

/**
 * Calibración guiada: el usuario sostiene la punta del índice quieta en el extremo izquierdo de
 * la viga y después en el derecho. Con los dos puntos sale el ancho y la altura de la viga; el
 * alto de una cuenta sale del tamaño de la mano, así el recorrido acompaña la distancia a la
 * cámara, y se achica si hace falta para que el soroban entre en la imagen.
 */
export class CalibrationCapture {
  private readonly tuning: CaptureTuning;
  private marks: Mark[] = [];
  private hold: Hold | null = null;
  private currentProgress = 0;
  private currentIssue: CaptureIssue | null = null;
  private box: CalibrationBox | null = null;

  constructor(tuning: Partial<CaptureTuning> = {}) {
    this.tuning = { ...CAPTURE_TUNING, ...tuning };
  }

  get step(): CaptureStep {
    return this.marks.length === 0 ? 'left' : 'right';
  }

  /** Cuánto del sostener lleva el punto actual, de 0 a 1. */
  get progress(): number {
    return this.currentProgress;
  }

  /** Los puntos ya marcados, para dibujarlos. */
  get points(): readonly Landmark[] {
    return this.marks.map((mark) => mark.point);
  }

  get issue(): CaptureIssue | null {
    return this.currentIssue;
  }

  /** La calibración, una vez marcados los dos extremos. */
  get result(): CalibrationBox | null {
    return this.box;
  }

  /** Un frame del tracker. Sin mano, o si el índice se movió, la espera vuelve a empezar. */
  update(frame: HandFrame | null, t: number): void {
    if (this.box) return;
    const tip = frame ? fingertip(frame, 'index') : null;
    if (!frame || !tip) {
      this.resetHold();
      return;
    }
    if (this.hold && distance(tip, this.hold.anchor) > this.tuning.stillRadius) this.resetHold();
    const hold = (this.hold ??= {
      start: t,
      anchor: tip,
      x: 0,
      y: 0,
      count: 0,
      scale: 0,
      scaleCount: 0,
    });
    hold.x += tip.x;
    hold.y += tip.y;
    hold.count++;
    const scale = handScale(frame);
    if (scale !== null) {
      hold.scale += scale;
      hold.scaleCount++;
    }
    this.currentProgress = Math.min(1, (t - hold.start) / this.tuning.holdMs);
    if (this.currentProgress < 1) return;

    const mark: Mark = {
      point: { x: hold.x / hold.count, y: hold.y / hold.count },
      scale: hold.scaleCount > 0 ? hold.scale / hold.scaleCount : null,
    };
    this.resetHold();
    this.accept(mark);
  }

  /** Vuelve al primer punto. */
  restart(): void {
    this.marks = [];
    this.box = null;
    this.currentIssue = null;
    this.resetHold();
  }

  private accept(mark: Mark): void {
    const first = this.marks[0];
    if (!first) {
      this.marks = [mark];
      this.currentIssue = null;
      return;
    }
    const left = Math.min(first.point.x, mark.point.x);
    const right = Math.max(first.point.x, mark.point.x);
    if (right - left < this.tuning.minWidth) {
      this.currentIssue = 'too-narrow';
      return;
    }
    const beamY = (first.point.y + mark.point.y) / 2;
    const beadHeight = Math.min(
      this.beadFromHand(first, mark),
      beamY / HEAVEN_TRACK,
      (1 - beamY) / EARTH_TRACK,
    );
    if (beadHeight < this.tuning.minBead) {
      this.restart();
      this.currentIssue = 'off-frame';
      return;
    }
    this.currentIssue = null;
    this.marks = [first, mark];
    this.box = { left, right, beamY, beadHeight };
  }

  /** Alto de cuenta según la mano; sin tamaño de mano, el del recuadro por defecto. */
  private beadFromHand(...marks: readonly Mark[]): number {
    const scales = marks.flatMap((mark) => (mark.scale === null ? [] : [mark.scale]));
    if (scales.length === 0) return defaultCalibration(1).beadHeight;
    const scale = scales.reduce((sum, s) => sum + s, 0) / scales.length;
    return scale * this.tuning.beadPerHand;
  }

  private resetHold(): void {
    this.hold = null;
    this.currentProgress = 0;
  }
}

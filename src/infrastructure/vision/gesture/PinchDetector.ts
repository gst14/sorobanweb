import { type HandFrame, INDEX_TIP, THUMB_TIP, distance, handScale } from '@/application/vision';

export type PinchEvent = 'start' | 'end';

export interface PinchOptions {
  /** Razón 4↔8 / 0↔9 por debajo de la cual empieza el pinch. */
  readonly enter?: number;
  /** Razón por encima de la cual termina. Mayor que `enter`: histéresis. */
  readonly exit?: number;
  /** Frames seguidos que tiene que sostenerse el cambio para aceptarlo. */
  readonly confirmFrames?: number;
}

/** Pinch entre pulgar e índice, normalizado por el tamaño de la mano, con histéresis y debounce. */
export class PinchDetector {
  private readonly enter: number;
  private readonly exit: number;
  private readonly confirmFrames: number;
  private pinched = false;
  private streak = 0;

  constructor({ enter = 0.25, exit = 0.4, confirmFrames = 3 }: PinchOptions = {}) {
    this.enter = enter;
    this.exit = exit;
    this.confirmFrames = confirmFrames;
  }

  get isPinched(): boolean {
    return this.pinched;
  }

  /** Devuelve 'start' o 'end' cuando el estado cambia; null si no. Ignora frames incompletos. */
  update(frame: HandFrame): PinchEvent | null {
    const scale = handScale(frame);
    const thumb = frame.landmarks[THUMB_TIP];
    const index = frame.landmarks[INDEX_TIP];
    if (scale === null || !thumb || !index) return null;
    const ratio = distance(thumb, index) / scale;
    const want = this.pinched ? ratio < this.exit : ratio < this.enter;
    if (want === this.pinched) {
      this.streak = 0;
      return null;
    }
    if (++this.streak < this.confirmFrames) return null;
    this.streak = 0;
    this.pinched = want;
    return want ? 'start' : 'end';
  }

  reset(): void {
    this.pinched = false;
    this.streak = 0;
  }
}

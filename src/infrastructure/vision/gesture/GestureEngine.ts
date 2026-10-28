import type { Move, Soroban } from '@/domain';
import type { Calibration } from './calibration';
import { type HandFrame, type PusherFinger, fingertip } from './landmarks';
import { type PinchPointerOptions, PinchPointer } from './PinchPointer';
import { type PusherOptions, Pusher } from './Pusher';

export type GestureMode = 'push' | 'pinch';

export interface GestureEngineOptions {
  readonly mode: GestureMode;
  readonly calibration: Calibration;
  /** Tiempo sin mano tras el cual se suelta todo (pinch, varilla activa, trazos). */
  readonly gapMs?: number;
  readonly pusher?: PusherOptions;
  readonly pointer?: PinchPointerOptions;
}

const FINGERS: readonly PusherFinger[] = ['thumb', 'index'];

/**
 * Convierte frames de la mano en movimientos de cuentas según el modo. Tolera huecos cortos
 * (frames perdidos u oclusiones) sin soltar el estado; pasado `gapMs` sin mano, lo reinicia.
 */
export class GestureEngine {
  readonly mode: GestureMode;
  private readonly gapMs: number;
  private readonly pushers: readonly (readonly [PusherFinger, Pusher])[];
  private readonly pointer: PinchPointer;
  private lastSeen: number | null = null;

  constructor({ mode, calibration, gapMs = 250, pusher, pointer }: GestureEngineOptions) {
    this.mode = mode;
    this.gapMs = gapMs;
    this.pushers = FINGERS.map((f) => [f, new Pusher(f, calibration, pusher)] as const);
    this.pointer = new PinchPointer(calibration, pointer);
  }

  /**
   * Procesa un frame (`null` = no se detectó mano en el instante `t`). Los movimientos salen de
   * `dragMove` y son válidos para el estado que recibieron; en el modo empuje, el índice ve el
   * soroban ya movido por el pulgar.
   */
  update(frame: HandFrame | null, t: number, soroban: Soroban): Move[] {
    if (!frame) {
      if (this.lastSeen !== null && t - this.lastSeen > this.gapMs) this.reset();
      return [];
    }
    this.lastSeen = frame.t;
    if (this.mode === 'pinch') {
      const move = this.pointer.update(frame, soroban);
      return move ? [move] : [];
    }
    const moves: Move[] = [];
    let state = soroban;
    for (const [finger, pusher] of this.pushers) {
      const tip = fingertip(frame, finger);
      const move = tip ? pusher.update(tip, frame.t, state) : null;
      if (!move) continue;
      state = state.apply(move);
      moves.push(move);
    }
    return moves;
  }

  reset(): void {
    for (const [, pusher] of this.pushers) pusher.reset();
    this.pointer.reset();
    this.lastSeen = null;
  }
}

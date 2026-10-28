import { type Move, type Soroban, dragMove, toMove } from '@/domain';
import { type Calibration, beadUnits, hitBead } from './calibration';
import type { Landmark, PusherFinger } from '@/application/vision';
import { type OneEuroOptions, OneEuro2D } from './OneEuro';
import { RodMapper } from './RodMapper';
import { StrokeWindow } from './StrokeWindow';

export interface PusherOptions {
  /** Ventana en la que tiene que ocurrir el desplazamiento: define la velocidad mínima. */
  readonly windowMs?: number;
  /** Desplazamiento mínimo, en alturas de cuenta. */
  readonly strokeBeads?: number;
  /** Tiempo mínimo entre dos movimientos de la misma varilla. */
  readonly cooldownMs?: number;
  readonly filter?: OneEuroOptions;
}

/**
 * Modo "empuje": la punta de un dedo empuja cuentas como en el ábaco físico. Un trazo vertical
 * rápido arrastra la cuenta donde empezó, con la misma física que el arrastre táctil
 * (`dragMove`): las cuentas entre el dedo y la viga, o las que quedan detrás, se mueven en bloque.
 */
export class Pusher {
  private readonly finger: PusherFinger;
  private readonly cal: Calibration;
  private readonly strokeBeads: number;
  private readonly cooldownMs: number;
  private readonly filter: OneEuro2D;
  private readonly mapper: RodMapper;
  private readonly stroke: StrokeWindow;
  private readonly lastMoveAt = new Map<number, number>();
  private rod: number | null = null;

  constructor(finger: PusherFinger, cal: Calibration, options: PusherOptions = {}) {
    const { windowMs = 250, strokeBeads = 0.35, cooldownMs = 120, filter } = options;
    this.finger = finger;
    this.cal = cal;
    this.strokeBeads = strokeBeads;
    this.cooldownMs = cooldownMs;
    this.filter = new OneEuro2D(filter);
    this.mapper = new RodMapper(cal);
    this.stroke = new StrokeWindow(windowMs);
  }

  /** Procesa la punta del dedo en el instante `t` y devuelve el movimiento, si lo hubo. */
  update(tip: Landmark, t: number, soroban: Soroban): Move | null {
    const p = this.filter.filter(tip, t);
    const u = beadUnits(this.cal, p.y);
    const rod = this.mapper.update(p.x);
    if (rod === null || rod >= soroban.rodCount) {
      this.rod = null;
      this.stroke.clear();
      return null;
    }
    if (rod !== this.rod) {
      this.rod = rod;
      this.stroke.restart(u, t);
      return null;
    }
    const anchor = this.stroke.push(u, t);
    const dy = u - anchor.u;
    if (Math.abs(dy) < this.strokeBeads) return null;
    this.stroke.restart(u, t);

    const state = soroban.rodAt(rod);
    const hit = hitBead(state, anchor.u);
    if (!hit) return null;
    const toward = hit.deck === 'earth' ? dy < 0 : dy > 0;
    const delta = dragMove(state, hit.deck, toward ? 'toward' : 'away', hit.slot);
    if (!delta) return null;
    const last = this.lastMoveAt.get(rod);
    if (last !== undefined && t - last < this.cooldownMs) return null;
    this.lastMoveAt.set(rod, t);
    return toMove(delta, rod, this.finger, t);
  }

  reset(): void {
    this.filter.reset();
    this.mapper.reset();
    this.stroke.clear();
    this.lastMoveAt.clear();
    this.rod = null;
  }
}

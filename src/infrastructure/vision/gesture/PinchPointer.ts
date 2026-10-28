import { type Move, type Soroban, dragMove, toMove } from '@/domain';
import { type BeadHit, type Calibration, beadUnits, hitBead } from './calibration';
import { type HandFrame, fingertip } from './landmarks';
import { type OneEuroOptions, OneEuro2D } from './OneEuro';
import { type PinchOptions, PinchDetector } from './PinchDetector';
import { RodMapper } from './RodMapper';

export interface PinchPointerOptions {
  /** Permanencia sobre una varilla antes de poder agarrarla. */
  readonly dwellMs?: number;
  /** Desplazamiento vertical, en alturas de cuenta, que arrastra la cuenta agarrada. */
  readonly strokeBeads?: number;
  readonly pinch?: PinchOptions;
  readonly filter?: OneEuroOptions;
}

interface Grab extends BeadHit {
  readonly rod: number;
  readonly u0: number;
  fired: boolean;
}

/**
 * Modo "puntero + pinch": la punta del índice es el cursor; tras `dwellMs` sobre una varilla,
 * el pinch agarra la cuenta bajo el cursor y un desplazamiento vertical la arrastra (una vez por
 * agarre, como el arrastre táctil). Soltar el pinch libera. No se valida el dedo: `finger` es
 * 'unknown'.
 */
export class PinchPointer {
  private readonly cal: Calibration;
  private readonly dwellMs: number;
  private readonly strokeBeads: number;
  private readonly filter: OneEuro2D;
  private readonly mapper: RodMapper;
  private readonly pinch: PinchDetector;
  private rod: number | null = null;
  private rodSince = 0;
  private grab: Grab | null = null;

  constructor(cal: Calibration, options: PinchPointerOptions = {}) {
    const { dwellMs = 150, strokeBeads = 0.35, pinch, filter } = options;
    this.cal = cal;
    this.dwellMs = dwellMs;
    this.strokeBeads = strokeBeads;
    this.filter = new OneEuro2D(filter);
    this.mapper = new RodMapper(cal);
    this.pinch = new PinchDetector(pinch);
  }

  /** Varilla bajo el cursor (o la agarrada) y si hay una cuenta agarrada, para el overlay. */
  get cursor(): { readonly rod: number | null; readonly grabbing: boolean } {
    return { rod: this.grab?.rod ?? this.rod, grabbing: this.grab !== null };
  }

  update(frame: HandFrame, soroban: Soroban): Move | null {
    const tip = fingertip(frame, 'index');
    if (!tip) return null;
    const { t } = frame;
    const p = this.filter.filter(tip, t);
    const u = beadUnits(this.cal, p.y);
    const event = this.pinch.update(frame);

    if (this.grab) {
      if (event === 'end') {
        this.grab = null;
        return null;
      }
      return this.drag(this.grab, u, t, soroban);
    }

    const rod = this.mapper.update(p.x);
    if (rod !== this.rod) {
      this.rod = rod;
      this.rodSince = t;
    }
    if (event !== 'start' || rod === null || rod >= soroban.rodCount) return null;
    if (t - this.rodSince < this.dwellMs) return null;
    const hit = hitBead(soroban.rodAt(rod), u);
    if (hit) this.grab = { ...hit, rod, u0: u, fired: false };
    return null;
  }

  private drag(grab: Grab, u: number, t: number, soroban: Soroban): Move | null {
    if (grab.fired) return null;
    const dy = u - grab.u0;
    if (Math.abs(dy) < this.strokeBeads) return null;
    grab.fired = true;
    const state = soroban.rodAt(grab.rod);
    const toward = grab.deck === 'earth' ? dy < 0 : dy > 0;
    const delta = dragMove(state, grab.deck, toward ? 'toward' : 'away', grab.slot);
    return delta ? toMove(delta, grab.rod, 'unknown', t) : null;
  }

  reset(): void {
    this.filter.reset();
    this.mapper.reset();
    this.pinch.reset();
    this.rod = null;
    this.grab = null;
  }
}

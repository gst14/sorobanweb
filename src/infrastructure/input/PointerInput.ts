import type { Clock, InputSource, MoveListener } from '@/application/ports';
import {
  type Deck,
  type EarthSlot,
  type MoveDelta,
  type Rod,
  type Soroban,
  dragMove,
  earthTap,
  heavenTap,
  isEarthSlot,
  toMove,
} from '@/domain';

export interface PointerInputOptions {
  /** Contenedor (el <svg>) cuyas cuentas llevan data-rod, data-deck y data-slot. */
  readonly element: Element;
  readonly getSoroban: () => Soroban;
  readonly clock: Clock;
  /** Desplazamiento máximo (px) para que el gesto cuente como tap. */
  readonly tapSlopPx?: number;
  /** Fracción de la altura de la cuenta que hay que arrastrar para mover. */
  readonly dragRatio?: number;
}

interface BeadTarget {
  readonly rod: number;
  readonly deck: Deck;
  readonly slot: EarthSlot;
  readonly element: Element;
}

interface Gesture {
  readonly target: BeadTarget;
  readonly startX: number;
  readonly startY: number;
  readonly thresholdPx: number;
  fired: boolean;
}

/** Lee la cuenta bajo el puntero a partir de los data-* que pone <SorobanSvg/>. */
export function readBeadTarget(target: EventTarget | null): BeadTarget | null {
  if (!(target instanceof Element)) return null;
  const bead = target.closest('[data-rod][data-deck]');
  if (!bead) return null;
  const rod = Number(bead.getAttribute('data-rod'));
  const deck = bead.getAttribute('data-deck');
  const slot = Number(bead.getAttribute('data-slot') ?? 0);
  if (!Number.isInteger(rod) || rod < 0) return null;
  if (deck !== 'heaven' && deck !== 'earth') return null;
  if (!isEarthSlot(slot)) return null;
  return { rod, deck, slot, element: bead };
}

/**
 * Entrada táctil y de ratón con Pointer Events. Tap = mover esa cuenta (con física real);
 * arrastre vertical = empujar hacia la viga o alejar de ella. Soporta varios punteros a la vez.
 */
export class PointerInput implements InputSource {
  readonly kind = 'pointer';
  private readonly options: Required<PointerInputOptions>;
  private readonly gestures = new Map<number, Gesture>();
  private listener: MoveListener | null = null;

  constructor(options: PointerInputOptions) {
    this.options = { tapSlopPx: 8, dragRatio: 0.35, ...options };
  }

  start(onMove: MoveListener): void {
    this.stop();
    this.listener = onMove;
    const el = this.options.element;
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMoveEvent);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onCancel);
    el.addEventListener('lostpointercapture', this.onCancel);
  }

  stop(): void {
    const el = this.options.element;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMoveEvent);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onCancel);
    el.removeEventListener('lostpointercapture', this.onCancel);
    this.gestures.clear();
    this.listener = null;
  }

  private readonly onDown = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    const target = readBeadTarget(event.target);
    if (!target || target.rod >= this.options.getSoroban().rodCount) return;
    event.preventDefault();
    const height = target.element.getBoundingClientRect().height;
    target.element.setPointerCapture(event.pointerId);
    this.gestures.set(event.pointerId, {
      target,
      startX: event.clientX,
      startY: event.clientY,
      thresholdPx: Math.max(this.options.tapSlopPx + 1, height * this.options.dragRatio),
      fired: false,
    });
  };

  private readonly onMoveEvent = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    const gesture = this.gestures.get(event.pointerId);
    if (!gesture || gesture.fired) return;
    const dy = event.clientY - gesture.startY;
    if (Math.abs(dy) < gesture.thresholdPx) return;
    gesture.fired = true;
    const { rod, deck, slot } = gesture.target;
    // En pantalla la y crece hacia abajo: la tierra está debajo de la viga y el cielo encima.
    const toward = deck === 'earth' ? dy < 0 : dy > 0;
    this.emit(rod, (r) => dragMove(r, deck, toward ? 'toward' : 'away', slot));
  };

  private readonly onUp = (event: Event): void => {
    if (!(event instanceof PointerEvent)) return;
    const gesture = this.gestures.get(event.pointerId);
    this.gestures.delete(event.pointerId);
    if (!gesture || gesture.fired) return;
    const moved = Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY);
    if (moved > this.options.tapSlopPx) return;
    const { rod, deck, slot } = gesture.target;
    this.emit(rod, (r) => (deck === 'heaven' ? heavenTap(r) : earthTap(r, slot)));
  };

  private readonly onCancel = (event: Event): void => {
    if (event instanceof PointerEvent) this.gestures.delete(event.pointerId);
  };

  private emit(rod: number, compute: (r: Rod) => MoveDelta | null): void {
    const soroban = this.options.getSoroban();
    if (rod >= soroban.rodCount || !this.listener) return;
    const delta = compute(soroban.rodAt(rod));
    if (delta) this.listener(toMove(delta, rod, 'unknown', this.options.clock.now()));
  }
}

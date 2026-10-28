import type { Clock, InputSource, MoveListener } from '@/application/ports';
import { type MoveDelta, type Soroban, toMove } from '@/domain';

export interface KeyboardInputOptions {
  /** Elemento que recibe los keydown (el soroban con foco, o window). */
  readonly element: EventTarget;
  readonly getSoroban: () => Soroban;
  readonly clock: Clock;
  /** Se llama cuando cambia la varilla seleccionada, para resaltarla. */
  readonly onSelect?: (rod: number) => void;
  /** Esc: borrar el ejercicio actual. */
  readonly onClear?: () => void;
}

/**
 * Teclado: ←/→ elige la varilla, ↑/↓ sube o baja una cuenta de tierra,
 * Shift+↓ baja el cielo (suma 5) y Shift+↑ lo sube (resta 5). Esc borra.
 */
export class KeyboardInput implements InputSource {
  readonly kind = 'keyboard';
  private readonly options: KeyboardInputOptions;
  private listener: MoveListener | null = null;
  private rod = 0;

  constructor(options: KeyboardInputOptions) {
    this.options = options;
  }

  get selectedRod(): number {
    return this.rod;
  }

  start(onMove: MoveListener): void {
    this.stop();
    this.listener = onMove;
    this.options.element.addEventListener('keydown', this.onKey);
  }

  stop(): void {
    this.options.element.removeEventListener('keydown', this.onKey);
    this.listener = null;
  }

  private readonly onKey = (event: Event): void => {
    if (!(event instanceof KeyboardEvent) || event.ctrlKey || event.metaKey || event.altKey) return;
    const soroban = this.options.getSoroban();
    this.rod = Math.min(this.rod, soroban.rodCount - 1);
    const handled = this.handle(event.key, event.shiftKey, soroban);
    if (handled) event.preventDefault();
  };

  private handle(key: string, shift: boolean, soroban: Soroban): boolean {
    switch (key) {
      case 'ArrowLeft':
        return this.select(Math.min(this.rod + 1, soroban.rodCount - 1));
      case 'ArrowRight':
        return this.select(Math.max(this.rod - 1, 0));
      case 'ArrowUp':
        return this.emit(
          soroban,
          shift ? { deck: 'heaven', delta: -1 } : { deck: 'earth', delta: 1 },
        );
      case 'ArrowDown':
        return this.emit(
          soroban,
          shift ? { deck: 'heaven', delta: 1 } : { deck: 'earth', delta: -1 },
        );
      case 'Escape':
        this.options.onClear?.();
        return true;
      default:
        return false;
    }
  }

  private select(rod: number): boolean {
    this.rod = rod;
    this.options.onSelect?.(rod);
    return true;
  }

  private emit(soroban: Soroban, delta: MoveDelta): boolean {
    const move = toMove(delta, this.rod, 'unknown', this.options.clock.now());
    if (this.listener && soroban.canApply(move)) this.listener(move);
    return true;
  }
}

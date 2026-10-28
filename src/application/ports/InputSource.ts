import type { Move } from '@/domain';

export type MoveListener = (move: Move) => void;

/** Fuente de movimientos: táctil/ratón, teclado o gestos. Todas emiten Move. */
export interface InputSource {
  readonly kind: 'pointer' | 'keyboard' | 'vision';
  start(onMove: MoveListener): void;
  stop(): void;
}

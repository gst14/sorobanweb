import type { Move } from './Move';

/** Un movimiento físicamente imposible para el estado actual del soroban. */
export class InvalidMoveError extends Error {
  readonly move: Move;

  constructor(move: Move, reason: string) {
    super(`Movimiento inválido en la varilla ${move.rod} (${move.deck} ${move.delta}): ${reason}`);
    this.name = 'InvalidMoveError';
    this.move = move;
  }
}

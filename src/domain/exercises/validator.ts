import { type Move, expectedFinger } from '../soroban/Move';
import { type RuleUse, planOperation } from '../soroban/operation';
import { Soroban } from '../soroban/Soroban';
import type { Exercise } from './Exercise';

/** Respuesta del usuario: un número tipeado (read) o el soroban final con sus movimientos. */
export type Attempt =
  | { readonly kind: 'number'; readonly value: number }
  | { readonly kind: 'beads'; readonly soroban: Soroban; readonly moves: readonly Move[] };

export interface ValidationResult {
  readonly correct: boolean;
  /** Proporción de movimientos hechos con el dedo correcto; null si no se conoce el dedo. */
  readonly techniqueScore: number | null;
  /** Movimientos de más respecto de la secuencia canónica. */
  readonly extraMoves: number;
  /** Primera regla cuya varilla quedó mal (solo en operaciones incorrectas). */
  readonly failedRule: RuleUse | null;
}

export function validate(exercise: Exercise, attempt: Attempt): ValidationResult {
  if (exercise.kind === 'read') {
    if (attempt.kind !== 'number') throw new TypeError('Un ejercicio de lectura espera un número');
    return Object.freeze({
      correct: attempt.value === exercise.target,
      techniqueScore: null,
      extraMoves: 0,
      failedRule: null,
    });
  }
  if (attempt.kind !== 'beads') throw new TypeError('Este ejercicio espera cuentas en el soroban');

  const { soroban, moves } = attempt;
  const expected = exercise.kind === 'set' ? exercise.target : exercise.expected;
  const correct = soroban.toNumber() === expected;
  const canonical =
    exercise.kind === 'set'
      ? planOperation(soroban.clear(), 'add', exercise.target).steps.length
      : exercise.steps.length;

  return Object.freeze({
    correct,
    techniqueScore: techniqueScore(moves),
    extraMoves: Math.max(0, moves.length - canonical),
    failedRule:
      correct || exercise.kind === 'set'
        ? null
        : firstWrongRule(exercise.ruleUses, soroban, expected),
  });
}

function techniqueScore(moves: readonly Move[]): number | null {
  const known = moves.filter((m) => m.finger !== 'unknown');
  if (known.length === 0) return null;
  return known.filter((m) => m.finger === expectedFinger(m)).length / known.length;
}

function firstWrongRule(
  ruleUses: readonly RuleUse[],
  soroban: Soroban,
  expected: number,
): RuleUse | null {
  const target = Soroban.fromNumber(expected, soroban.rodCount, soroban.unitRod);
  return ruleUses.find((u) => soroban.rodValue(u.rod) !== target.rodValue(u.rod)) ?? null;
}

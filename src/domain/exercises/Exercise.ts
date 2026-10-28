import { type PlannedStep, type RuleUse, planOperation } from '../soroban/operation';
import type { Operation } from '../soroban/rules';
import { Soroban } from '../soroban/Soroban';

/**
 * Los ejercicios se planifican sobre la cantidad mínima de varillas que muestra la UI
 * (mobile vertical), así que cualquier ejercicio cabe en cualquier layout.
 */
export const EXERCISE_RODS = 7;

export interface Term {
  readonly op: Operation;
  readonly value: number;
}

/** Decodificar: se muestra una configuración de cuentas y el usuario escribe el número. */
export interface ReadExercise {
  readonly kind: 'read';
  readonly id: string;
  readonly target: number;
}

/** Codificar: se muestra un número y el usuario lo pone en el soroban, partiendo de cero. */
export interface SetExercise {
  readonly kind: 'set';
  readonly id: string;
  readonly target: number;
}

/** Operar: el soroban arranca en `start` y el usuario aplica cada término. */
export interface OperationExercise {
  readonly kind: 'operation';
  readonly id: string;
  readonly start: number;
  readonly terms: readonly Term[];
  readonly expected: number;
  readonly ruleUses: readonly RuleUse[];
  /** Secuencia canónica completa, para el tutorial y para contar movimientos de más. */
  readonly steps: readonly PlannedStep[];
}

export type Exercise = ReadExercise | SetExercise | OperationExercise;

export const readExercise = (id: string, target: number): ReadExercise =>
  Object.freeze({ kind: 'read', id, target: Soroban.fromNumber(target, EXERCISE_RODS).toNumber() });

export const setExercise = (id: string, target: number): SetExercise =>
  Object.freeze({ kind: 'set', id, target: Soroban.fromNumber(target, EXERCISE_RODS).toNumber() });

/** Arma un ejercicio de operación planificando cada término en orden. Lanza si no es válido. */
export function operationExercise(
  id: string,
  start: number,
  terms: readonly Term[],
): OperationExercise {
  if (terms.length === 0) throw new RangeError('Un ejercicio de operación necesita términos');
  let state = Soroban.fromNumber(start, EXERCISE_RODS);
  const ruleUses: RuleUse[] = [];
  const steps: PlannedStep[] = [];
  for (const term of terms) {
    const plan = planOperation(state, term.op, term.value);
    ruleUses.push(...plan.ruleUses);
    steps.push(...plan.steps);
    state = plan.result;
  }
  return Object.freeze({
    kind: 'operation',
    id,
    start,
    terms: Object.freeze(terms.map((t) => Object.freeze({ ...t }))),
    expected: state.toNumber(),
    ruleUses: Object.freeze(ruleUses),
    steps: Object.freeze(steps),
  });
}

/** Soroban inicial con el que arranca el ejercicio. */
export const initialSoroban = (exercise: Exercise, rodCount = EXERCISE_RODS): Soroban =>
  Soroban.fromNumber(
    exercise.kind === 'read' ? exercise.target : exercise.kind === 'set' ? 0 : exercise.start,
    rodCount,
  );

/** Respuesta numérica esperada. */
export const expectedValue = (exercise: Exercise): number =>
  exercise.kind === 'operation' ? exercise.expected : exercise.target;

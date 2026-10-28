import type { Operation, Rule } from '../../soroban/rules';
import { EXERCISE_RODS, type OperationExercise, type Term, operationExercise } from '../Exercise';
import type { Rng } from '../Rng';

export interface ChainConfig {
  /** Cantidad de términos (2–15). */
  readonly terms: number;
  /** Cifras de cada término. */
  readonly digits: 1 | 2 | 3;
  readonly ops: readonly Operation[];
  /** Reglas permitidas: ningún paso del ejercicio puede usar otra. */
  readonly allowed: readonly Rule[];
  /** Si se indica, el ejercicio usa esta regla al menos una vez. */
  readonly require?: Rule;
  /** Valor inicial del soroban (por defecto 0). */
  readonly start?: number;
}

const TERM_ATTEMPTS = 200;
const CHAIN_ATTEMPTS = 100;

/** Encadenado de N términos (mitori-zan) restringido a las reglas permitidas. */
export function generateChain(rng: Rng, config: ChainConfig, id: string): OperationExercise {
  for (let attempt = 0; attempt < CHAIN_ATTEMPTS; attempt++) {
    const exercise = tryChain(rng, config, id);
    if (exercise && (!config.require || exercise.ruleUses.some((u) => u.rule === config.require))) {
      return exercise;
    }
  }
  throw new Error(`No se pudo generar un encadenado con la configuración pedida (${id})`);
}

function tryChain(rng: Rng, config: ChainConfig, id: string): OperationExercise | null {
  const start = config.start ?? 0;
  let exercise: OperationExercise | null = null;
  const terms: Term[] = [];
  for (let i = 0; i < config.terms; i++) {
    const current = exercise?.expected ?? start;
    const next = nextTerm(rng, config, id, start, terms, current);
    if (!next) return null;
    exercise = next.exercise;
    terms.push(next.term);
  }
  return exercise;
}

const CAPACITY = 10 ** EXERCISE_RODS;

function nextTerm(
  rng: Rng,
  config: ChainConfig,
  id: string,
  start: number,
  previous: readonly Term[],
  current: number,
): { term: Term; exercise: OperationExercise } | null {
  const min = config.digits === 1 ? 1 : 10 ** (config.digits - 1);
  const max = 10 ** config.digits - 1;
  for (let attempt = 0; attempt < TERM_ATTEMPTS; attempt++) {
    const term: Term = { op: rng.pick(config.ops), value: rng.int(min, max) };
    const result = term.op === 'add' ? current + term.value : current - term.value;
    if (result < 0 || result >= CAPACITY) continue;
    const exercise = operationExercise(id, start, [...previous, term]);
    if (exercise.ruleUses.every((u) => config.allowed.includes(u.rule))) return { term, exercise };
  }
  return null;
}

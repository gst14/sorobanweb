import { type ReadExercise, type SetExercise, readExercise, setExercise } from '../Exercise';
import type { Rng } from '../Rng';

export interface ReadingConfig {
  /** read = decodificar cuentas → número; set = número → cuentas. */
  readonly kind: 'read' | 'set';
  /** Cantidad máxima de cifras: 1 → 0..9, 2 → 0..99, 3 → 0..999. */
  readonly maxDigits: 1 | 2 | 3;
}

export function generateReading(
  rng: Rng,
  config: ReadingConfig,
  id: string,
): ReadExercise | SetExercise {
  const target = rng.int(0, 10 ** config.maxDigits - 1);
  return config.kind === 'read' ? readExercise(id, target) : setExercise(id, target);
}

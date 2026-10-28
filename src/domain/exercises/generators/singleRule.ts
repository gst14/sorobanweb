import { DIGITS } from '../../soroban/Digit';
import { type RuleItem, candidatesFor, classify } from '../../soroban/rules';
import { type OperationExercise, operationExercise } from '../Exercise';
import type { Rng } from '../Rng';

/**
 * Ejercicio aislado de una regla: se elige el ítem (op, regla, d) y después el valor de la
 * varilla uniformemente entre los candidatos donde la regla aplica. Así se evita el sesgo de
 * generar números al azar (por ejemplo, que casi siempre salgan pares que suman 5).
 *
 * Si hay llevada o préstamo, la varilla de la izquierda recibe un valor para el que ese ±1
 * es directo, de modo que el ejercicio no mezcla otras reglas.
 */
export function generateSingleRule(
  rng: Rng,
  items: readonly RuleItem[],
  id: string,
): OperationExercise {
  const item = rng.pick(items);
  const v = rng.pick(candidatesFor(item));
  const carries = item.rule === 'ten' || item.rule === 'combined';
  const tens = carries ? rng.pick(neighborsWithDirectCarry(item)) : 0;
  return operationExercise(id, tens * 10 + v, [{ op: item.op, value: item.d }]);
}

/** Valores de la varilla izquierda para los que el ±1 de la llevada/préstamo es directo. */
const neighborsWithDirectCarry = (item: RuleItem) =>
  DIGITS.filter((t) => classify(item.op, t, 1) === 'direct');

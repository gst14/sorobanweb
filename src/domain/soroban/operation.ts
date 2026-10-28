import { type Digit, type NonZeroDigit, digitsOf } from './Digit';
import type { MoveDelta } from './Move';
import { toMove } from './Move';
import type { Operation, Rule } from './rules';
import type { Soroban } from './Soroban';
import { rodTechnique } from './technique';

/** Un paso del plan: un MoveDelta sobre una varilla concreta. */
export type PlannedStep = MoveDelta & { readonly rod: number };

/** Una aplicación de regla en una varilla. `carry` = vino de una llevada o un préstamo. */
export interface RuleUse {
  readonly op: Operation;
  readonly rule: Rule;
  /** Valor de la varilla antes de aplicar la regla. */
  readonly v: Digit;
  readonly d: NonZeroDigit;
  readonly rod: number;
  readonly carry: boolean;
}

export interface OperationPlan {
  readonly steps: readonly PlannedStep[];
  readonly ruleUses: readonly RuleUse[];
  readonly result: Soroban;
}

/**
 * Planifica `soroban ± operand` con la técnica del soroban: dígito a dígito de izquierda a
 * derecha, a partir de la varilla de unidades, propagando llevadas y préstamos en cascada.
 */
export function planOperation(soroban: Soroban, op: Operation, operand: number): OperationPlan {
  if (!Number.isSafeInteger(operand) || operand < 0) {
    throw new RangeError(`Operando inválido: ${operand}`);
  }
  const current = soroban.toNumber();
  const expected = op === 'add' ? current + operand : current - operand;
  if (expected < 0) throw new RangeError(`El resultado sería negativo: ${current} − ${operand}`);

  const steps: PlannedStep[] = [];
  const ruleUses: RuleUse[] = [];
  let state = soroban;

  const operate = (rod: number, d: Digit, carry: boolean): void => {
    if (rod >= state.rodCount) {
      throw new RangeError(`El resultado ${expected} no entra en ${state.rodCount} varillas`);
    }
    if (d === 0) return;
    const v = state.rodValue(rod);
    const technique = rodTechnique(op, v, d);
    ruleUses.push(Object.freeze({ op, rule: technique.rule, v, d, rod, carry }));
    const propagate = (): void => {
      if (technique.carry !== 0) operate(rod + 1, 1, true);
    };
    if (technique.carryFirst) propagate();
    for (const step of technique.steps) {
      const planned: PlannedStep = { ...step, rod };
      state = state.apply(toMove(planned, rod, 'unknown', 0));
      steps.push(Object.freeze(planned));
    }
    if (!technique.carryFirst) propagate();
  };

  const digits = [...digitsOf(operand)].reverse(); // izquierda → derecha
  digits.forEach((d, i) => {
    operate(state.unitRod + digits.length - 1 - i, d, false);
  });

  return Object.freeze({
    steps: Object.freeze(steps),
    ruleUses: Object.freeze(ruleUses),
    result: state,
  });
}

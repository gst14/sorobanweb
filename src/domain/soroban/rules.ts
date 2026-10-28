import { DIGITS, type Digit, NON_ZERO_DIGITS, type NonZeroDigit } from './Digit';

/**
 * Las cuatro técnicas de suma/resta de un dígito sobre una varilla:
 * - direct: hay cuentas disponibles.
 * - five: amigos del 5 (suma: +5 −(5−d); resta: +(5−d) −5).
 * - ten: amigos del 10 (suma: −(10−d) y +10 a la izquierda; resta: −10 a la izquierda y +(10−d)).
 * - combined: el complemento de 10 exige a su vez un complemento de 5.
 */
export type Rule = 'direct' | 'five' | 'ten' | 'combined';
export type Operation = 'add' | 'sub';

export const RULES: readonly Rule[] = Object.freeze(['direct', 'five', 'ten', 'combined']);
export const OPERATIONS: readonly Operation[] = Object.freeze(['add', 'sub']);

/** Clasifica "sumar d a una varilla con valor v" según la técnica del soroban. */
export function classifyAdd(v: Digit, d: NonZeroDigit): Rule {
  const vh = v >= 5;
  const ve = v % 5;
  const dh = d >= 5;
  const de = d % 5;
  if (v + d <= 9) {
    // Sin llevada nunca coinciden los dos cielos (v + d ≥ 10), así que decide la tierra.
    const direct = !(dh && vh) && ve + de <= 4;
    return direct ? 'direct' : 'five';
  }
  const c = 10 - d; // complemento a 10 que hay que quitar de la varilla
  const ch = c >= 5;
  const ce = c % 5;
  const canRemoveDirect = (!ch || vh) && ve >= ce;
  return canRemoveDirect ? 'ten' : 'combined'; // combined: −c = +(5−c) −5
}

/** Clasifica "restar d a una varilla con valor v" según la técnica del soroban. */
export function classifySub(v: Digit, d: NonZeroDigit): Rule {
  const vh = v >= 5;
  const ve = v % 5;
  const dh = d >= 5;
  const de = d % 5;
  if (v - d >= 0) {
    const direct = (!dh || vh) && ve >= de;
    return direct ? 'direct' : 'five'; // five: −d = +(5−d) −5
  }
  const c = 10 - d; // complemento a 10 que hay que agregar tras pedir prestado
  const canAddDirect = !(c >= 5 && vh) && ve + (c % 5) <= 4;
  return canAddDirect ? 'ten' : 'combined'; // combined: +c = +5 −(5−c)
}

export const classify = (op: Operation, v: Digit, d: NonZeroDigit): Rule =>
  op === 'add' ? classifyAdd(v, d) : classifySub(v, d);

/** Ítem atómico de aprendizaje y de repetición espaciada: (operación, regla, dígito). */
export interface RuleItem {
  readonly op: Operation;
  readonly rule: Rule;
  readonly d: NonZeroDigit;
}

export const ruleItemKey = (item: RuleItem): string => `${item.op}:${item.rule}:${item.d}`;

/** Valores de varilla v para los que (op, d) se resuelve con `rule`. */
export const candidatesFor = (item: RuleItem): readonly Digit[] =>
  DIGITS.filter((v) => classify(item.op, v, item.d) === item.rule);

/** Los 52 ítems que existen: 26 de suma y 26 de resta. */
export const RULE_ITEMS: readonly RuleItem[] = Object.freeze(
  OPERATIONS.flatMap((op) =>
    RULES.flatMap((rule) =>
      NON_ZERO_DIGITS.filter((d) => DIGITS.some((v) => classify(op, v, d) === rule)).map(
        (d): RuleItem => Object.freeze({ op, rule, d }),
      ),
    ),
  ),
);

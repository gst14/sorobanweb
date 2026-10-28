import { type MoveDelta, expectedFinger } from '../soroban/Move';
import type { Operation, Rule, RuleItem } from '../soroban/rules';

export const RULE_LABELS: Readonly<Record<Rule, string>> = Object.freeze({
  direct: 'Directo',
  five: 'Amigos del 5',
  ten: 'Amigos del 10',
  combined: 'Combinado',
});

const MINUS = '−';
const plus = (n: number) => `+${String(n)}`;
const minus = (n: number) => `${MINUS}${String(n)}`;

/** Fórmula de la técnica: "+3 = +5 −2", "−4 = −10 +6", "+7 = +2 −5 +10". */
export function describeRule({ op, rule, d }: RuleItem): string {
  const c = 10 - d;
  const head = op === 'add' ? plus(d) : minus(d);
  switch (rule) {
    case 'direct':
      return head;
    case 'five':
      return op === 'add' ? `${head} = +5 ${minus(5 - d)}` : `${head} = ${plus(5 - d)} ${MINUS}5`;
    case 'ten':
      return op === 'add' ? `${head} = ${minus(c)} +10` : `${head} = ${MINUS}10 ${plus(c)}`;
    case 'combined':
      return op === 'add'
        ? `${head} = ${plus(5 - c)} ${MINUS}5 +10`
        : `${head} = ${MINUS}10 +5 ${minus(5 - c)}`;
  }
}

const FINGER_NAMES = { thumb: 'pulgar', index: 'índice', unknown: '' } as const;

/** Instrucción para un paso: "Subí 2 cuentas de tierra (pulgar)". */
export function describeStep(step: MoveDelta): string {
  const finger = FINGER_NAMES[expectedFinger(step)];
  if (step.deck === 'heaven') {
    return `${step.delta > 0 ? 'Bajá' : 'Subí'} la cuenta del cielo (${finger})`;
  }
  const n = Math.abs(step.delta);
  const beads = n === 1 ? 'cuenta' : 'cuentas';
  return `${step.delta > 0 ? 'Subí' : 'Bajá'} ${String(n)} ${beads} de tierra (${finger})`;
}

/** Instrucción para la llevada (suma) o el préstamo (resta). */
export const describeCarry = (op: Operation): string =>
  op === 'add'
    ? 'Llevá 1 a la varilla de la izquierda'
    : 'Pedí 1 prestado a la varilla de la izquierda';

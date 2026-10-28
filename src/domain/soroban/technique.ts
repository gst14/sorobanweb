import type { Digit, NonZeroDigit } from './Digit';
import { type MoveDelta, toEarthDelta } from './Move';
import { type Operation, type Rule, classify } from './rules';

/**
 * Técnica canónica para operar un dígito sobre una varilla.
 * `steps` actúa sobre la propia varilla; `carry` es el ±1 que va a la varilla de la izquierda.
 * En la suma se quita primero el complemento y después se lleva (§2.3);
 * en la resta primero se pide prestado y después se suma el complemento.
 */
export interface RodTechnique {
  readonly op: Operation;
  readonly rule: Rule;
  readonly d: NonZeroDigit;
  readonly steps: readonly MoveDelta[];
  readonly carry: -1 | 0 | 1;
  readonly carryFirst: boolean;
}

const heaven = (delta: 1 | -1): MoveDelta => ({ deck: 'heaven', delta });
const earth = (n: number): MoveDelta => ({ deck: 'earth', delta: toEarthDelta(n) });

/** Pone n (0..9) directo: el índice baja el 5 y el pulgar sube las unidades. */
function put(n: number): MoveDelta[] {
  return [...(n >= 5 ? [heaven(1)] : []), ...(n % 5 > 0 ? [earth(n % 5)] : [])];
}

/** Quita n (0..9) directo. */
function take(n: number): MoveDelta[] {
  return [...(n >= 5 ? [heaven(-1)] : []), ...(n % 5 > 0 ? [earth(-(n % 5))] : [])];
}

function stepsFor(op: Operation, rule: Rule, d: NonZeroDigit): MoveDelta[] {
  const c = 10 - d;
  switch (rule) {
    case 'direct':
      return op === 'add' ? put(d) : take(d);
    case 'five':
      // suma: +5 −(5−d); resta: +(5−d) −5. Solo ocurre con d = 1..4.
      return op === 'add' ? [heaven(1), earth(-(5 - d))] : [earth(5 - d), heaven(-1)];
    case 'ten':
      // suma: −c (+10 a la izquierda); resta: (−10 a la izquierda) +c.
      return op === 'add' ? take(c) : put(c);
    case 'combined':
      // Solo con d = 6..9, así que c = 1..4.
      // suma: −c = +(5−c) −5; resta: +c = +5 −(5−c).
      return op === 'add' ? [earth(5 - c), heaven(-1)] : [heaven(1), earth(-(5 - c))];
  }
}

export function rodTechnique(op: Operation, v: Digit, d: NonZeroDigit): RodTechnique {
  const rule = classify(op, v, d);
  const carries = rule === 'ten' || rule === 'combined';
  return Object.freeze({
    op,
    rule,
    d,
    steps: Object.freeze(stepsFor(op, rule, d)),
    carry: carries ? (op === 'add' ? 1 : -1) : 0,
    carryFirst: carries && op === 'sub',
  });
}

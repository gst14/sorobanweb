import {
  type Exercise,
  type RuleUse,
  RULE_LABELS,
  describeCarry,
  describeRule,
  describeStep,
  rodTechnique,
  ruleItemKey,
} from '@/domain';
import type { ExerciseOutcome } from '@/application/usecases';

const MINUS = '−';

/** Enunciado del ejercicio. */
export function exercisePrompt(exercise: Exercise): {
  readonly title: string;
  readonly expression?: string;
} {
  switch (exercise.kind) {
    case 'read':
      return { title: '¿Qué número muestra el soroban?' };
    case 'set':
      return { title: 'Poné este número en el soroban', expression: String(exercise.target) };
    case 'operation': {
      const terms = exercise.terms
        .map((t) => `${t.op === 'add' ? '+' : MINUS} ${String(t.value)}`)
        .join(' ');
      return { title: 'Operá en el soroban', expression: `${String(exercise.start)} ${terms}` };
    }
  }
}

/**
 * Pista para la regla que falló: "Amigos del 5: +3 = +5 −2".
 * En las directas la fórmula no dice nada nuevo, así que se describen los pasos.
 */
export function ruleHint(use: RuleUse): string {
  const formula = describeRule(use);
  if (use.rule === 'direct') {
    const steps = rodTechnique(use.op, use.v, use.d).steps.map(describeStep);
    const text = steps.join(', ').toLowerCase();
    return `${RULE_LABELS.direct}: ${formula} · ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
  }
  const carry = use.rule === 'ten' || use.rule === 'combined' ? ` · ${describeCarry(use.op)}` : '';
  return `${RULE_LABELS[use.rule]}: ${formula}${carry}`;
}

/** Reglas falladas en la lección, sin repetir, en el orden en que fallaron. */
export function failedRules(outcomes: readonly ExerciseOutcome[]): readonly RuleUse[] {
  const seen = new Set<string>();
  const rules: RuleUse[] = [];
  for (const { result } of outcomes) {
    const rule = result.failedRule;
    if (!rule || seen.has(ruleItemKey(rule))) continue;
    seen.add(ruleItemKey(rule));
    rules.push(rule);
  }
  return rules;
}

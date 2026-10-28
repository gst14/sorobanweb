import { describe, expect, it } from 'vitest';
import { operationExercise, readExercise, setExercise } from '@/domain';
import type { ExerciseOutcome } from '@/application/usecases';
import { exercisePrompt, failedRules, ruleHint } from './prompt';

describe('exercisePrompt', () => {
  it('describe cada tipo de ejercicio', () => {
    expect(exercisePrompt(readExercise('r', 5)).title).toMatch(/Qué número/);
    expect(exercisePrompt(setExercise('s', 42)).expression).toBe('42');
    const op = operationExercise('o', 3, [
      { op: 'add', value: 2 },
      { op: 'sub', value: 1 },
    ]);
    expect(exercisePrompt(op).expression).toBe('3 + 2 − 1');
  });
});

describe('ruleHint / failedRules', () => {
  const five = { op: 'add', rule: 'five', v: 3, d: 2, rod: 0, carry: false } as const;
  const ten = { op: 'sub', rule: 'ten', v: 0, d: 1, rod: 0, carry: false } as const;

  it('pista con la fórmula y, si hay llevada, la instrucción', () => {
    expect(ruleHint(five)).toBe('Amigos del 5: +2 = +5 −3');
    expect(ruleHint(ten)).toBe(
      'Amigos del 10: −1 = −10 +9 · Pedí 1 prestado a la varilla de la izquierda',
    );
  });

  it('en las directas describe los pasos', () => {
    const direct = { op: 'add', rule: 'direct', v: 0, d: 7, rod: 0, carry: false } as const;
    expect(ruleHint(direct)).toBe(
      'Directo: +7 · Bajá la cuenta del cielo (índice), subí 2 cuentas de tierra (pulgar)',
    );
    expect(ruleHint({ ...direct, op: 'sub', v: 3, d: 3 })).toBe(
      'Directo: −3 · Bajá 3 cuentas de tierra (índice)',
    );
  });

  it('agrupa reglas falladas sin repetir', () => {
    const outcome = (failedRule: typeof five | typeof ten | null): ExerciseOutcome => ({
      exercise: readExercise('x', 1),
      latencyMs: 0,
      result: { correct: failedRule === null, techniqueScore: null, extraMoves: 0, failedRule },
    });
    expect(failedRules([outcome(five), outcome(null), outcome(five), outcome(ten)])).toEqual([
      five,
      ten,
    ]);
  });
});

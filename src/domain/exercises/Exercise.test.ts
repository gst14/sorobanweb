import { describe, expect, it } from 'vitest';
import {
  EXERCISE_RODS,
  expectedValue,
  initialSoroban,
  operationExercise,
  readExercise,
  setExercise,
} from './Exercise';

describe('Exercise', () => {
  it('read: arranca mostrando el objetivo', () => {
    const ex = readExercise('r1', 307);
    expect(ex).toEqual({ kind: 'read', id: 'r1', target: 307 });
    expect(initialSoroban(ex).toNumber()).toBe(307);
    expect(expectedValue(ex)).toBe(307);
  });

  it('set: arranca en cero', () => {
    const ex = setExercise('s1', 42);
    expect(initialSoroban(ex).toNumber()).toBe(0);
    expect(expectedValue(ex)).toBe(42);
  });

  it('read y set rechazan números que no entran en el soroban de ejercicios', () => {
    expect(() => readExercise('x', 10 ** EXERCISE_RODS)).toThrow(RangeError);
    expect(() => setExercise('x', -1)).toThrow(RangeError);
  });

  it('operation: encadena términos y acumula reglas y pasos', () => {
    const ex = operationExercise('o1', 3, [
      { op: 'add', value: 2 },
      { op: 'add', value: 5 },
      { op: 'sub', value: 1 },
    ]);
    expect(ex.expected).toBe(9);
    // 3+2 five; 5+5 ten con llevada directa; 10−1 ten con préstamo directo
    expect(ex.ruleUses.map((u) => u.rule)).toEqual(['five', 'ten', 'direct', 'ten', 'direct']);
    expect(ex.steps.length).toBeGreaterThan(0);
    expect(initialSoroban(ex, 13).rodCount).toBe(13);
    expect(initialSoroban(ex).toNumber()).toBe(3);
    expect(expectedValue(ex)).toBe(9);
  });

  it('operation: es inmutable', () => {
    const ex = operationExercise('o2', 0, [{ op: 'add', value: 7 }]);
    expect(Object.isFrozen(ex)).toBe(true);
    expect(Object.isFrozen(ex.terms)).toBe(true);
    expect(Object.isFrozen(ex.terms[0])).toBe(true);
  });

  it('operation: rechaza ejercicios sin términos o con resultado negativo', () => {
    expect(() => operationExercise('x', 1, [])).toThrow(RangeError);
    expect(() => operationExercise('x', 1, [{ op: 'sub', value: 2 }])).toThrow(RangeError);
  });
});

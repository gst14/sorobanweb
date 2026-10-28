import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type Operation, classify } from './rules';
import { planOperation } from './operation';
import { Soroban } from './Soroban';

const s7 = (n: number) => Soroban.fromNumber(n, 7);

describe('planOperation', () => {
  it('3 + 2 en una varilla: amigo del 5', () => {
    const plan = planOperation(s7(3), 'add', 2);
    expect(plan.result.toNumber()).toBe(5);
    expect(plan.ruleUses).toEqual([{ op: 'add', rule: 'five', v: 3, d: 2, rod: 0, carry: false }]);
    expect(plan.steps).toEqual([
      { deck: 'heaven', delta: 1, rod: 0 },
      { deck: 'earth', delta: -3, rod: 0 },
    ]);
  });

  it('99 + 1: cascada de llevadas (ten en unidades y en decenas)', () => {
    const plan = planOperation(s7(99), 'add', 1);
    expect(plan.result.toNumber()).toBe(100);
    expect(plan.ruleUses.map((u) => [u.rod, u.rule, u.carry])).toEqual([
      [0, 'ten', false],
      [1, 'ten', true],
      [2, 'direct', true],
    ]);
  });

  it('999 + 1 → 1000', () => {
    const plan = planOperation(s7(999), 'add', 1);
    expect(plan.result.toNumber()).toBe(1000);
    expect(plan.ruleUses.filter((u) => u.carry)).toHaveLength(3);
  });

  it('100 − 1: el préstamo va antes que el complemento', () => {
    const plan = planOperation(s7(100), 'sub', 1);
    expect(plan.result.toNumber()).toBe(99);
    // pide prestado en cascada hasta las centenas, después suma los complementos
    expect(plan.ruleUses.map((u) => [u.rod, u.rule])).toEqual([
      [0, 'ten'],
      [1, 'ten'],
      [2, 'direct'],
    ]);
    expect(plan.steps[0]?.rod).toBe(2);
  });

  it('1000 − 1 → 999', () => {
    expect(planOperation(s7(1000), 'sub', 1).result.toNumber()).toBe(999);
  });

  it('una llevada sobre una varilla en 4 dispara five: 49 + 1', () => {
    const plan = planOperation(s7(49), 'add', 1);
    expect(plan.ruleUses[1]).toEqual({
      op: 'add',
      rule: 'five',
      v: 4,
      d: 1,
      rod: 1,
      carry: true,
    });
  });

  it('multi-dígito de izquierda a derecha: 25 + 37', () => {
    const plan = planOperation(s7(25), 'add', 37);
    expect(plan.result.toNumber()).toBe(62);
    expect(plan.ruleUses.map((u) => [u.rod, u.d, u.rule])).toEqual([
      [1, 3, 'five'],
      [0, 7, 'combined'],
      [1, 1, 'direct'],
    ]);
  });

  it('respeta la varilla de unidades', () => {
    const plan = planOperation(Soroban.fromNumber(12, 7, 2), 'add', 9);
    expect(plan.result.toNumber()).toBe(21);
    expect(plan.steps.every((s) => s.rod >= 2)).toBe(true);
  });

  it('ignora los ceros del operando', () => {
    const plan = planOperation(s7(5), 'add', 100);
    expect(plan.ruleUses).toEqual([
      { op: 'add', rule: 'direct', v: 0, d: 1, rod: 2, carry: false },
    ]);
  });

  it('rechaza operandos inválidos, resultados negativos y desbordes', () => {
    expect(() => planOperation(s7(5), 'add', -1)).toThrow(RangeError);
    expect(() => planOperation(s7(5), 'add', 1.5)).toThrow(RangeError);
    expect(() => planOperation(s7(5), 'sub', 6)).toThrow(RangeError);
    expect(() => planOperation(s7(9_999_999), 'add', 1)).toThrow(RangeError);
    expect(() => planOperation(s7(0), 'add', 10_000_000)).toThrow(RangeError);
  });

  it('es inmutable y no modifica el soroban de entrada', () => {
    const start = s7(6);
    const plan = planOperation(start, 'add', 4);
    expect(start.toNumber()).toBe(6);
    expect(Object.isFrozen(plan.steps)).toBe(true);
    expect(Object.isFrozen(plan.ruleUses)).toBe(true);
  });

  it('propiedad: el resultado es a ± b y cada uso coincide con classify', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999 }),
        fc.integer({ min: 0, max: 999_999 }),
        fc.constantFrom<Operation>('add', 'sub'),
        (a, b, op) => {
          fc.pre(op === 'add' ? a + b <= 9_999_999 : a >= b);
          const plan = planOperation(s7(a), op, b);
          expect(plan.result.toNumber()).toBe(op === 'add' ? a + b : a - b);

          for (const use of plan.ruleUses) {
            expect(classify(use.op, use.v, use.d)).toBe(use.rule);
          }
          // reproducir los pasos sobre el soroban original llega al mismo resultado
          let state = s7(a);
          for (const step of plan.steps) state = state.apply({ ...step, finger: 'unknown', at: 0 });
          expect(state.equals(plan.result)).toBe(true);
        },
      ),
    );
  });
});

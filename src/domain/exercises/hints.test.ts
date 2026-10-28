import { describe, expect, it } from 'vitest';
import { RULE_ITEMS, type RuleItem } from '../soroban/rules';
import { RULE_LABELS, describeCarry, describeRule, describeStep } from './hints';

describe('describeRule', () => {
  it.each<[RuleItem, string]>([
    [{ op: 'add', rule: 'direct', d: 3 }, '+3'],
    [{ op: 'sub', rule: 'direct', d: 7 }, '−7'],
    [{ op: 'add', rule: 'five', d: 3 }, '+3 = +5 −2'],
    [{ op: 'sub', rule: 'five', d: 3 }, '−3 = +2 −5'],
    [{ op: 'add', rule: 'ten', d: 4 }, '+4 = −6 +10'],
    [{ op: 'sub', rule: 'ten', d: 4 }, '−4 = −10 +6'],
    [{ op: 'add', rule: 'combined', d: 7 }, '+7 = +2 −5 +10'],
    [{ op: 'sub', rule: 'combined', d: 6 }, '−6 = −10 +5 −1'],
  ])('%j → %s', (item, text) => {
    expect(describeRule(item)).toBe(text);
  });

  it('las 52 descripciones son únicas', () => {
    expect(new Set(RULE_ITEMS.map(describeRule)).size).toBe(52);
  });

  it('cada fórmula suma lo que dice el ítem', () => {
    for (const item of RULE_ITEMS) {
      const [head, rhs] = describeRule(item).replaceAll('−', '-').split(' = ');
      if (rhs === undefined) continue;
      const total = rhs.split(' ').reduce((acc, t) => acc + Number(t), 0);
      expect(total).toBe(Number(head));
    }
  });
});

describe('describeStep', () => {
  it('describe tierra y cielo con el dedo correcto', () => {
    expect(describeStep({ deck: 'earth', delta: 2 })).toBe('Subí 2 cuentas de tierra (pulgar)');
    expect(describeStep({ deck: 'earth', delta: -1 })).toBe('Bajá 1 cuenta de tierra (índice)');
    expect(describeStep({ deck: 'heaven', delta: 1 })).toBe('Bajá la cuenta del cielo (índice)');
    expect(describeStep({ deck: 'heaven', delta: -1 })).toBe('Subí la cuenta del cielo (índice)');
  });
});

describe('describeCarry / RULE_LABELS', () => {
  it('textos de llevada y préstamo', () => {
    expect(describeCarry('add')).toMatch(/Llevá 1/);
    expect(describeCarry('sub')).toMatch(/prestado/);
  });

  it('etiquetas de las cuatro reglas', () => {
    expect(Object.values(RULE_LABELS)).toEqual([
      'Directo',
      'Amigos del 5',
      'Amigos del 10',
      'Combinado',
    ]);
  });
});

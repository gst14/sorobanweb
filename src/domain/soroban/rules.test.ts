import { describe, expect, it } from 'vitest';
import { DIGITS, type Digit, NON_ZERO_DIGITS, type NonZeroDigit } from './Digit';
import { Rod } from './Rod';
import { EXPECTED_ADD, EXPECTED_SUB } from './rules.fixtures';
import {
  type Operation,
  type Rule,
  RULE_ITEMS,
  candidatesFor,
  classify,
  classifyAdd,
  classifySub,
  ruleItemKey,
} from './rules';

const PAIRS: readonly (readonly [Digit, NonZeroDigit])[] = DIGITS.flatMap((v) =>
  NON_ZERO_DIGITS.map((d) => [v, d] as const),
);

const expected = (table: readonly (readonly Rule[])[], v: Digit, d: NonZeroDigit): Rule => {
  const rule = table[v]?.[d - 1];
  if (rule === undefined) throw new Error(`Falta la celda v=${String(v)} d=${String(d)}`);
  return rule;
};

/**
 * Oráculo independiente: simula las cuentas con Rod e intenta las técnicas en orden
 * (directo → amigo del 5), devolviendo null si es físicamente imposible.
 */
type Attempt = { rod: Rod; usedFive: boolean } | null;

function addOnRod(rod: Rod, n: number): Attempt {
  const nh = n >= 5;
  const ne = n % 5;
  if (!(nh && rod.heaven) && rod.canMoveEarth(ne)) {
    return { rod: rod.setHeaven(rod.heaven || nh).moveEarth(ne), usedFive: false };
  }
  if (!nh && !rod.heaven && rod.canMoveEarth(-(5 - n))) {
    return { rod: rod.setHeaven(true).moveEarth(-(5 - n)), usedFive: true };
  }
  return null;
}

function subOnRod(rod: Rod, n: number): Attempt {
  const nh = n >= 5;
  const ne = n % 5;
  if ((!nh || rod.heaven) && rod.canMoveEarth(-ne)) {
    return { rod: rod.setHeaven(rod.heaven && !nh).moveEarth(-ne), usedFive: false };
  }
  if (!nh && rod.heaven && rod.canMoveEarth(5 - n)) {
    return { rod: rod.moveEarth(5 - n).setHeaven(false), usedFive: true };
  }
  return null;
}

function simulate(op: Operation, v: Digit, d: NonZeroDigit): Rule {
  const rod = Rod.of(v);
  const noCarry = op === 'add' ? v + d <= 9 : v - d >= 0;
  const attempt = noCarry
    ? (op === 'add' ? addOnRod : subOnRod)(rod, d)
    : (op === 'add' ? subOnRod : addOnRod)(rod, 10 - d);
  if (attempt === null) throw new Error(`Sin técnica para ${op} v=${String(v)} d=${String(d)}`);
  const result = op === 'add' ? (v + d) % 10 : (v - d + 10) % 10;
  expect(attempt.rod.value).toBe(result);
  if (noCarry) return attempt.usedFive ? 'five' : 'direct';
  return attempt.usedFive ? 'combined' : 'ten';
}

describe('classifyAdd', () => {
  it.each(PAIRS)('v=%d + d=%d coincide con la tabla escrita a mano', (v, d) => {
    expect(classifyAdd(v, d)).toBe(expected(EXPECTED_ADD, v, d));
  });

  it.each(PAIRS)('v=%d + d=%d coincide con el oráculo de cuentas', (v, d) => {
    expect(classifyAdd(v, d)).toBe(simulate('add', v, d));
  });
});

describe('classifySub', () => {
  it.each(PAIRS)('v=%d − d=%d coincide con la tabla escrita a mano', (v, d) => {
    expect(classifySub(v, d)).toBe(expected(EXPECTED_SUB, v, d));
  });

  it.each(PAIRS)('v=%d − d=%d coincide con el oráculo de cuentas', (v, d) => {
    expect(classifySub(v, d)).toBe(simulate('sub', v, d));
  });
});

describe('casos testigo', () => {
  it.each<[Operation, Digit, NonZeroDigit, Rule, string]>([
    ['add', 2, 2, 'direct', 'el pulgar sube 2'],
    ['add', 3, 2, 'five', '+5 −3'],
    ['add', 4, 1, 'five', '+5 −4'],
    ['add', 6, 4, 'ten', '−6 y +10'],
    ['add', 5, 5, 'ten', '−5 y +10'],
    ['add', 5, 7, 'combined', '+2 −5 y +10'],
    ['add', 9, 1, 'ten', '−9 y +10'],
    ['sub', 6, 3, 'five', '+2 −5'],
    ['sub', 5, 1, 'five', '+4 −5'],
    ['sub', 0, 1, 'ten', '−10 y +9'],
    ['sub', 5, 6, 'ten', '−10 y +4'],
    ['sub', 3, 6, 'combined', '−10, +5 −1'],
  ])('%s v=%d d=%d → %s (%s)', (op, v, d, rule) => {
    expect(classify(op, v, d)).toBe(rule);
  });
});

describe('invariantes', () => {
  const count = (op: Operation) => {
    const counts: Record<Rule, number> = { direct: 0, five: 0, ten: 0, combined: 0 };
    for (const [v, d] of PAIRS) counts[classify(op, v, d)] += 1;
    return counts;
  };

  it.each<Operation>(['add', 'sub'])('%s: 35 direct, 10 five, 35 ten, 10 combined', (op) => {
    expect(count(op)).toEqual({ direct: 35, five: 10, ten: 35, combined: 10 });
  });

  it('dualidad por complemento a 9: classifyAdd(v, d) = classifySub(9 − v, d)', () => {
    for (const [v, d] of PAIRS) {
      const dual = DIGITS[9 - v];
      if (dual === undefined) throw new Error('unreachable');
      expect(classifyAdd(v, d)).toBe(classifySub(dual, d));
    }
  });

  it('sin llevada ni préstamo la regla es direct o five; con ellos, ten o combined', () => {
    const withCarry: readonly Rule[] = ['ten', 'combined'];
    for (const [v, d] of PAIRS) {
      expect(withCarry.includes(classifyAdd(v, d))).toBe(v + d > 9);
      expect(withCarry.includes(classifySub(v, d))).toBe(v - d < 0);
    }
  });

  it('combined solo aparece con d = 6..9', () => {
    for (const [v, d] of PAIRS) {
      if (classifyAdd(v, d) === 'combined' || classifySub(v, d) === 'combined') {
        expect(d).toBeGreaterThanOrEqual(6);
      }
    }
  });
});

describe('RULE_ITEMS', () => {
  it('hay 52 ítems únicos (26 por operación)', () => {
    expect(RULE_ITEMS).toHaveLength(52);
    expect(new Set(RULE_ITEMS.map(ruleItemKey)).size).toBe(52);
    expect(RULE_ITEMS.filter((i) => i.op === 'add')).toHaveLength(26);
    expect(Object.isFrozen(RULE_ITEMS)).toBe(true);
  });

  it('five usa d = 1..4 y combined d = 6..9 en ambas operaciones', () => {
    const ds = (op: Operation, rule: Rule) =>
      RULE_ITEMS.filter((i) => i.op === op && i.rule === rule).map((i) => i.d);
    for (const op of ['add', 'sub'] as const) {
      expect(ds(op, 'direct')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(ds(op, 'five')).toEqual([1, 2, 3, 4]);
      expect(ds(op, 'ten')).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(ds(op, 'combined')).toEqual([6, 7, 8, 9]);
    }
  });

  it('cada ítem tiene al menos un candidato y todos clasifican igual', () => {
    for (const item of RULE_ITEMS) {
      const candidates = candidatesFor(item);
      expect(candidates.length).toBeGreaterThan(0);
      for (const v of candidates) expect(classify(item.op, v, item.d)).toBe(item.rule);
    }
  });

  it('candidatos concretos: +3 por amigo del 5 solo desde 2, 3 o 4', () => {
    expect(candidatesFor({ op: 'add', rule: 'five', d: 3 })).toEqual([2, 3, 4]);
    expect(ruleItemKey({ op: 'add', rule: 'five', d: 3 })).toBe('add:five:3');
  });
});

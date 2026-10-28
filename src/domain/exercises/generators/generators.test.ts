import { describe, expect, it } from 'vitest';
import { RULE_ITEMS, type Rule, candidatesFor } from '../../soroban/rules';
import { createRng } from '../Rng';
import { generateChain } from './chain';
import { generateReading } from './reading';
import { generateSingleRule } from './singleRule';

describe('generateReading', () => {
  it('read: genera objetivos en el rango y cubre todo 0..9', () => {
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const ex = generateReading(rng, { kind: 'read', maxDigits: 1 }, `r${String(i)}`);
      expect(ex.kind).toBe('read');
      seen.add(ex.target);
    }
    expect(seen.size).toBe(10);
  });

  it('set: respeta maxDigits', () => {
    const rng = createRng(2);
    for (let i = 0; i < 200; i++) {
      const ex = generateReading(rng, { kind: 'set', maxDigits: 3 }, 's');
      expect(ex.kind).toBe('set');
      expect(ex.target).toBeLessThanOrEqual(999);
    }
  });
});

describe('generateSingleRule', () => {
  it.each(RULE_ITEMS.map((item) => [item.op, item.rule, item.d, item] as const))(
    '%s %s d=%d: usa solo esa regla (más ±1 directo) y cubre todos los candidatos',
    (op, rule, d, item) => {
      const rng = createRng(d * 31 + rule.length);
      const seen = new Set<number>();
      for (let i = 0; i < 300; i++) {
        const ex = generateSingleRule(rng, [item], 'x');
        expect(ex.terms).toEqual([{ op, value: d }]);
        const [main, ...carries] = ex.ruleUses;
        expect(main?.rule).toBe(rule);
        expect(main?.d).toBe(d);
        for (const c of carries) {
          expect(c.carry).toBe(true);
          expect(c.rule).toBe('direct');
        }
        expect(ex.expected).toBeGreaterThanOrEqual(0);
        seen.add(ex.start % 10);
      }
      expect([...seen].sort()).toEqual([...candidatesFor(item)].sort());
    },
  );

  it('distribución por ítem aproximadamente uniforme (10⁴ muestras, chi² laxo)', () => {
    const rng = createRng(123);
    const items = RULE_ITEMS.filter((i) => i.op === 'add' && i.rule === 'five');
    const counts = new Map<string, number>();
    const n = 10_000;
    for (let i = 0; i < n; i++) {
      const ex = generateSingleRule(rng, items, 'x');
      const key = `${String(ex.terms[0]?.value)}@${String(ex.start % 10)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    // 4 ítems: d=1 (1 candidato), d=2 (2), d=3 (3), d=4 (4) → 10 celdas
    expect(counts.size).toBe(10);
    for (const [key, count] of counts) {
      const d = Number(key.split('@')[0]);
      const expected = n / items.length / d;
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.15);
    }
  });
});

describe('generateChain', () => {
  it.each<[readonly Rule[], Rule | undefined]>([
    [['direct'], undefined],
    [['direct', 'five'], 'five'],
    [['direct', 'five', 'ten'], 'ten'],
  ])('reglas permitidas %j, requiere %s', (allowed, require) => {
    const rng = createRng(77);
    for (let i = 0; i < 100; i++) {
      const ex = generateChain(
        rng,
        { terms: 5, digits: 1, ops: ['add', 'sub'], allowed, ...(require ? { require } : {}) },
        'c',
      );
      expect(ex.terms).toHaveLength(5);
      expect(ex.ruleUses.every((u) => allowed.includes(u.rule))).toBe(true);
      if (require) expect(ex.ruleUses.some((u) => u.rule === require)).toBe(true);
      expect(ex.expected).toBeGreaterThanOrEqual(0);
    }
  });

  it('términos de 2 cifras partiendo de un valor inicial', () => {
    const rng = createRng(5);
    const ex = generateChain(
      rng,
      {
        terms: 3,
        digits: 2,
        ops: ['add'],
        allowed: ['direct', 'five', 'ten', 'combined'],
        start: 50,
      },
      'c',
    );
    expect(ex.start).toBe(50);
    for (const t of ex.terms) {
      expect(t.value).toBeGreaterThanOrEqual(10);
      expect(t.value).toBeLessThanOrEqual(99);
    }
  });

  it('descarta términos que desbordan el soroban', () => {
    const rng = createRng(9);
    const ex = generateChain(
      rng,
      {
        terms: 2,
        digits: 2,
        ops: ['add', 'sub'],
        allowed: ['direct', 'five', 'ten', 'combined'],
        start: 9_999_950,
      },
      'c',
    );
    expect(ex.expected).toBeLessThan(10_000_000);
  });

  it('lanza si la configuración es imposible', () => {
    // desde 0, sumar siempre es directo: nunca se puede usar solo "five"
    expect(() =>
      generateChain(createRng(1), { terms: 1, digits: 1, ops: ['add'], allowed: ['five'] }, 'c'),
    ).toThrow(/No se pudo generar/);
    // nunca aparece "ten" si solo se permite direct
    expect(() =>
      generateChain(
        createRng(1),
        { terms: 2, digits: 1, ops: ['add'], allowed: ['direct'], require: 'ten' },
        'c',
      ),
    ).toThrow(/No se pudo generar/);
  });
});

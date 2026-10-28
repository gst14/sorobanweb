import { describe, expect, it } from 'vitest';
import { DIGITS, type Digit, NON_ZERO_DIGITS, type NonZeroDigit } from './Digit';
import type { MoveDelta } from './Move';
import { Rod } from './Rod';
import type { Operation, Rule } from './rules';
import { rodTechnique } from './technique';

const PAIRS: readonly (readonly [Digit, NonZeroDigit])[] = DIGITS.flatMap((v) =>
  NON_ZERO_DIGITS.map((d) => [v, d] as const),
);

/** Aplica pasos verificando que cada uno sea físicamente posible. */
function run(rod: Rod, steps: readonly MoveDelta[]): Rod {
  return steps.reduce((r, s) => {
    if (s.deck === 'earth') {
      expect(r.canMoveEarth(s.delta)).toBe(true);
      return r.moveEarth(s.delta);
    }
    expect(r.heaven).toBe(s.delta < 0);
    return r.setHeaven(s.delta > 0);
  }, rod);
}

describe('rodTechnique', () => {
  describe.each<Operation>(['add', 'sub'])('%s', (op) => {
    it.each(PAIRS)('v=%d d=%d: los pasos son válidos y dejan el dígito correcto', (v, d) => {
      const t = rodTechnique(op, v, d);
      const raw = op === 'add' ? v + d : v - d;
      expect(run(Rod.of(v), t.steps).value).toBe((raw + 10) % 10);
      expect(t.carry).toBe(raw > 9 ? 1 : raw < 0 ? -1 : 0);
      expect(t.carryFirst).toBe(raw < 0);
    });
  });

  it('cantidad de pasos por regla', () => {
    const lengths = new Map<Rule, Set<number>>();
    for (const op of ['add', 'sub'] as const) {
      for (const [v, d] of PAIRS) {
        const t = rodTechnique(op, v, d);
        lengths.set(t.rule, (lengths.get(t.rule) ?? new Set()).add(t.steps.length));
      }
    }
    expect(lengths.get('five')).toEqual(new Set([2]));
    expect(lengths.get('combined')).toEqual(new Set([2]));
    // direct y ten: 1 paso si solo se mueve el cielo o solo la tierra; 2 si se mueven ambos.
    expect(lengths.get('direct')).toEqual(new Set([1, 2]));
    expect(lengths.get('ten')).toEqual(new Set([1, 2]));
  });

  it.each<[Operation, Digit, NonZeroDigit, readonly MoveDelta[], -1 | 0 | 1]>([
    [
      'add',
      3,
      2,
      [
        { deck: 'heaven', delta: 1 },
        { deck: 'earth', delta: -3 },
      ],
      0,
    ],
    [
      'add',
      6,
      4,
      [
        { deck: 'heaven', delta: -1 },
        { deck: 'earth', delta: -1 },
      ],
      1,
    ],
    [
      'add',
      5,
      7,
      [
        { deck: 'earth', delta: 2 },
        { deck: 'heaven', delta: -1 },
      ],
      1,
    ],
    [
      'add',
      2,
      7,
      [
        { deck: 'heaven', delta: 1 },
        { deck: 'earth', delta: 2 },
      ],
      0,
    ],
    [
      'sub',
      6,
      3,
      [
        { deck: 'earth', delta: 2 },
        { deck: 'heaven', delta: -1 },
      ],
      0,
    ],
    [
      'sub',
      0,
      1,
      [
        { deck: 'heaven', delta: 1 },
        { deck: 'earth', delta: 4 },
      ],
      -1,
    ],
    [
      'sub',
      3,
      6,
      [
        { deck: 'heaven', delta: 1 },
        { deck: 'earth', delta: -1 },
      ],
      -1,
    ],
    ['sub', 4, 5, [{ deck: 'heaven', delta: 1 }], -1],
  ])('%s v=%d d=%d: secuencia canónica', (op, v, d, steps, carry) => {
    const t = rodTechnique(op, v, d);
    expect(t.steps).toEqual(steps);
    expect(t.carry).toBe(carry);
  });

  it('es inmutable', () => {
    const t = rodTechnique('add', 6, 4);
    expect(Object.isFrozen(t)).toBe(true);
    expect(Object.isFrozen(t.steps)).toBe(true);
  });
});

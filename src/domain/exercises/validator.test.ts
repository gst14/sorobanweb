import { describe, expect, it } from 'vitest';
import type { Finger, Move } from '../soroban/Move';
import { toMove } from '../soroban/Move';
import type { PlannedStep } from '../soroban/operation';
import { Soroban } from '../soroban/Soroban';
import {
  EXERCISE_RODS,
  initialSoroban,
  operationExercise,
  readExercise,
  setExercise,
} from './Exercise';
import { validate } from './validator';

/** La secuencia canónica de un ejercicio como movimientos hechos con el dedo indicado. */
const canonicalMoves = (steps: readonly PlannedStep[], finger: Finger): Move[] =>
  steps.map((s, i) => toMove(s, s.rod, finger, i));

describe('validate', () => {
  describe('read', () => {
    const ex = readExercise('r', 47);

    it('compara el número tipeado', () => {
      expect(validate(ex, { kind: 'number', value: 47 }).correct).toBe(true);
      expect(validate(ex, { kind: 'number', value: 74 })).toEqual({
        correct: false,
        techniqueScore: null,
        extraMoves: 0,
        failedRule: null,
      });
    });

    it('rechaza un intento con cuentas', () => {
      expect(() =>
        validate(ex, { kind: 'beads', soroban: Soroban.create(EXERCISE_RODS), moves: [] }),
      ).toThrow(TypeError);
    });
  });

  describe('set', () => {
    const ex = setExercise('s', 7);

    it('correcto con la secuencia canónica: 0 movimientos de más', () => {
      const moves: Move[] = [
        toMove({ deck: 'heaven', delta: 1 }, 0, 'index', 0),
        toMove({ deck: 'earth', delta: 2 }, 0, 'thumb', 1),
      ];
      const soroban = moves.reduce((s, m) => s.apply(m), initialSoroban(ex));
      expect(validate(ex, { kind: 'beads', soroban, moves })).toEqual({
        correct: true,
        techniqueScore: 1,
        extraMoves: 0,
        failedRule: null,
      });
    });

    it('cuenta movimientos de más (subir 3 y bajar 1 para dejar 2)', () => {
      const ex2 = setExercise('s2', 2);
      const moves: Move[] = [
        toMove({ deck: 'earth', delta: 3 }, 0, 'thumb', 0),
        toMove({ deck: 'earth', delta: -1 }, 0, 'index', 1),
      ];
      const soroban = moves.reduce((s, m) => s.apply(m), initialSoroban(ex2));
      const result = validate(ex2, { kind: 'beads', soroban, moves });
      expect(result.correct).toBe(true);
      expect(result.extraMoves).toBe(1);
    });

    it('incorrecto no etiqueta regla', () => {
      const result = validate(ex, {
        kind: 'beads',
        soroban: Soroban.fromNumber(6, EXERCISE_RODS),
        moves: [],
      });
      expect(result.correct).toBe(false);
      expect(result.failedRule).toBeNull();
    });

    it('rechaza un número tipeado', () => {
      expect(() => validate(ex, { kind: 'number', value: 7 })).toThrow(TypeError);
    });
  });

  describe('operation', () => {
    // 6 + 4: ten en unidades (quitar 6) y +1 directo en decenas
    const ex = operationExercise('o', 6, [{ op: 'add', value: 4 }]);

    it('la secuencia canónica es correcta, sin movimientos de más', () => {
      const moves = canonicalMoves(ex.steps, 'unknown');
      const soroban = moves.reduce((s, m) => s.apply(m), initialSoroban(ex));
      expect(validate(ex, { kind: 'beads', soroban, moves })).toEqual({
        correct: true,
        techniqueScore: null,
        extraMoves: 0,
        failedRule: null,
      });
    });

    it('techniqueScore: proporción de movimientos con el dedo correcto', () => {
      // pasos: cielo −1 (índice), tierra −1 (índice), decenas tierra +1 (pulgar)
      const moves = canonicalMoves(ex.steps, 'index');
      const soroban = moves.reduce((s, m) => s.apply(m), initialSoroban(ex));
      const result = validate(ex, { kind: 'beads', soroban, moves });
      expect(result.techniqueScore).toBeCloseTo(2 / 3);
    });

    it('si falla, etiqueta la primera regla cuya varilla quedó mal', () => {
      // el usuario puso 1 en decenas pero dejó 6 en unidades → falló el "ten" de unidades
      const soroban = Soroban.fromNumber(16, EXERCISE_RODS);
      const result = validate(ex, { kind: 'beads', soroban, moves: [] });
      expect(result.correct).toBe(false);
      expect(result.failedRule).toMatchObject({ rule: 'ten', rod: 0 });
    });

    it('si la varilla mal no corresponde a ninguna regla, failedRule es null', () => {
      const soroban = Soroban.fromNumber(110, EXERCISE_RODS);
      expect(validate(ex, { kind: 'beads', soroban, moves: [] }).failedRule).toBeNull();
    });
  });
});

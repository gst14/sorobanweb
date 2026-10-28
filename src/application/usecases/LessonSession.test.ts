import { describe, expect, it } from 'vitest';
import { type Move, createRng, lessonById, planOperation, toMove } from '@/domain';
import {
  type LessonSessionState,
  acceptsMoves,
  applyMoveToSession,
  currentExercise,
  expireIfTimeUp,
  nextExercise,
  remainingMs,
  resetExercise,
  resizeSession,
  sessionScore,
  startSession,
  submitAnswer,
} from './LessonSession';

const start = (lessonId: string, seed = 1) =>
  startSession(lessonById(lessonId), createRng(seed), 0, 7);

/** Resuelve el ejercicio actual con la secuencia canónica, o lo deja sin tocar si `correct` es false. */
function solve(state: LessonSessionState, now: number, correct = true) {
  const ex = currentExercise(state);
  if (ex.kind === 'read') return submitAnswer(state, now, correct ? ex.target : ex.target + 1);
  const steps = !correct
    ? []
    : ex.kind === 'operation'
      ? ex.steps
      : planOperation(state.soroban, 'add', ex.target).steps;
  const solved = steps.reduce(
    (s, step) => applyMoveToSession(s, toMove(step, step.rod, 'unknown', now)),
    state,
  );
  return submitAnswer(solved, now);
}

describe('LessonSession', () => {
  it('arranca en el primer ejercicio, jugando', () => {
    const s = start('w1-add');
    expect(s.status).toBe('playing');
    expect(s.index).toBe(0);
    expect(s.exercises).toHaveLength(15);
    expect(s.soroban.rodCount).toBe(7);
    expect(acceptsMoves(s)).toBe(true);
  });

  it('una lección completa con todo correcto aprueba', () => {
    let s = start('w1-add');
    let now = 0;
    while (s.status !== 'finished') {
      now += 1000;
      s = solve(s, now).state;
      expect(s.status).toBe('feedback');
      s = nextExercise(s, now);
    }
    expect(sessionScore(s)).toEqual({ correct: 15, total: 15, livesLost: 0 });
    expect(s.outcomes.every((o) => o.latencyMs === 1000)).toBe(true);
  });

  it('lectura: no acepta moves y valida el número tipeado', () => {
    const s = start('w0-read-1');
    expect(acceptsMoves(s)).toBe(false);
    const move: Move = { rod: 0, deck: 'earth', delta: 1, finger: 'unknown', at: 0 };
    expect(applyMoveToSession(s, move)).toBe(s);
    expect(resetExercise(s)).toBe(s);
    expect(solve(s, 10).outcome.result.correct).toBe(true);
    expect(solve(s, 10, false).outcome.result.correct).toBe(false);
    expect(submitAnswer(s, 10).outcome.result.correct).toBe(false);
  });

  it('poner números: el ejercicio set arranca en cero y se valida', () => {
    const s = start('w0-set-2');
    expect(s.soroban.toNumber()).toBe(0);
    expect(solve(s, 5).outcome.result.correct).toBe(true);
  });

  it('descarta moves inválidos sin romper la sesión', () => {
    const s = start('w1-sub');
    const impossible: Move = { rod: 6, deck: 'earth', delta: -1, finger: 'unknown', at: 0 };
    expect(applyMoveToSession(s, impossible)).toBe(s);
  });

  it('resetExercise vuelve al inicio del ejercicio', () => {
    const s = start('w1-add');
    const moved = applyMoveToSession(s, {
      rod: 3,
      deck: 'earth',
      delta: 1,
      finger: 'unknown',
      at: 0,
    });
    expect(moved.moves).toHaveLength(1);
    const reset = resetExercise(moved);
    expect(reset.moves).toHaveLength(0);
    expect(reset.soroban.equals(s.soroban)).toBe(true);
  });

  it('jefe con vidas: termina al agotarlas', () => {
    let s = start('w2-boss');
    for (let i = 0; i < 3; i++) {
      s = solve(s, 1, false).state;
      s = nextExercise(s, 1);
    }
    expect(s.status).toBe('finished');
    expect(s.livesLost).toBe(3);
    expect(sessionScore(s).total).toBe(10);
  });

  it('jefe con tiempo: remainingMs y expiración', () => {
    const s = start('w0-boss');
    expect(remainingMs(s, 10_000)).toBe(50_000);
    expect(expireIfTimeUp(s, 59_999)).toBe(s);
    const expired = expireIfTimeUp(s, 60_000);
    expect(expired.status).toBe('finished');
    expect(expireIfTimeUp(expired, 70_000)).toBe(expired);
    expect(remainingMs(start('w1-add'), 10)).toBeNull();
    // si el tiempo se agota entre ejercicios, nextExercise termina
    const answered = solve(s, 61_000).state;
    expect(nextExercise(answered, 61_000).status).toBe('finished');
  });

  it('submit fuera de juego lanza y next fuera de feedback no hace nada', () => {
    const s = start('w1-add');
    expect(nextExercise(s, 0)).toBe(s);
    const fb = solve(s, 1).state;
    expect(() => submitAnswer(fb, 2)).toThrow();
  });

  it('resizeSession cambia las varillas sin alterar el valor', () => {
    const s = start('w3-add');
    const value = s.soroban.toNumber();
    const wide = resizeSession(s, 13);
    expect(wide.soroban.rodCount).toBe(13);
    expect(wide.soroban.toNumber()).toBe(value);
    expect(resizeSession(wide, 13)).toBe(wide);
  });

  it('currentExercise lanza si el índice no existe', () => {
    const s = start('w1-add');
    expect(() => currentExercise({ ...s, index: 99 })).toThrow(RangeError);
  });
});

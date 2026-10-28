import { describe, expect, it } from 'vitest';
import { createRng } from '../exercises/Rng';
import { isLessonPassed, isUnlocked, nextLesson } from './lessonProgress';
import { LESSONS, WORLDS, generateLesson, lessonById } from './worlds';

describe('WORLDS', () => {
  it('mundos 0 a 3, cada uno cerrado por un jefe', () => {
    expect(WORLDS.map((w) => w.id)).toEqual([0, 1, 2, 3]);
    for (const w of WORLDS) {
      expect(w.lessons.at(-1)?.boss).toBeDefined();
      for (const l of w.lessons) expect(l.worldId).toBe(w.id);
    }
  });

  it('ids únicos y lecciones congeladas', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect(Object.isFrozen(LESSONS)).toBe(true);
    expect(LESSONS.every((l) => Object.isFrozen(l))).toBe(true);
  });

  it('lessonById encuentra y lanza con ids desconocidos', () => {
    expect(lessonById('w2-add').title).toBe('Sumar con amigos del 5');
    expect(() => lessonById('nope')).toThrow(RangeError);
  });
});

describe('generateLesson', () => {
  it.each(LESSONS.map((l) => [l.id, l] as const))(
    '%s: genera exerciseCount ejercicios que usan solo sus reglas',
    (_, lesson) => {
      for (const seed of [1, 2, 3]) {
        const exercises = generateLesson(lesson, createRng(seed));
        expect(exercises).toHaveLength(lesson.exerciseCount);
        for (const ex of exercises) {
          expect(ex.id.startsWith(`${lesson.id}#`)).toBe(true);
          if (ex.kind === 'operation') {
            for (const use of ex.ruleUses) expect(lesson.allowedRules).toContain(use.rule);
          }
        }
      }
    },
  );

  it('es reproducible con la misma semilla', () => {
    const lesson = lessonById('w3-mix');
    expect(generateLesson(lesson, createRng(9))).toEqual(generateLesson(lesson, createRng(9)));
  });

  it('las lecciones de una regla la usan en todos los ejercicios', () => {
    for (const id of ['w2-add', 'w2-sub', 'w3-add', 'w3-sub']) {
      const lesson = lessonById(id);
      const rule = lesson.source.kind === 'singleRule' ? lesson.source.items[0]?.rule : undefined;
      for (const ex of generateLesson(lesson, createRng(4))) {
        expect(ex.kind === 'operation' && ex.ruleUses[0]?.rule).toBe(rule);
      }
    }
  });

  it('el jefe del mundo 3 son cascadas: siempre hay llevadas o préstamos encadenados', () => {
    for (const ex of generateLesson(lessonById('w3-boss'), createRng(1))) {
      expect(ex.kind === 'operation' && ex.ruleUses.filter((u) => u.carry).length).toBeGreaterThan(
        0,
      );
    }
  });
});

describe('isLessonPassed', () => {
  const normal = lessonById('w1-add');
  const boss = lessonById('w2-boss');

  it('aprueba con ≥ 80 %', () => {
    expect(isLessonPassed(normal, { correct: 12, total: 15 })).toBe(true);
    expect(isLessonPassed(normal, { correct: 11, total: 15 })).toBe(false);
  });

  it('sin ejercicios no aprueba', () => {
    expect(isLessonPassed(normal, { correct: 0, total: 0 })).toBe(false);
  });

  it('un jefe con vidas no aprueba si se agotaron', () => {
    expect(isLessonPassed(boss, { correct: 10, total: 10, livesLost: 2 })).toBe(true);
    expect(isLessonPassed(boss, { correct: 10, total: 10, livesLost: 3 })).toBe(false);
    expect(isLessonPassed(boss, { correct: 9, total: 10 })).toBe(true);
  });

  it('el jefe del mundo 1 exige el 100 %', () => {
    expect(isLessonPassed(lessonById('w1-boss'), { correct: 0, total: 1, livesLost: 0 })).toBe(
      false,
    );
  });
});

describe('isUnlocked / nextLesson', () => {
  it('la primera lección está abierta y el resto se abre en orden', () => {
    const [first, second, third] = LESSONS;
    if (!first || !second || !third) throw new Error('faltan lecciones');
    expect(isUnlocked(first.id, new Set())).toBe(true);
    expect(isUnlocked(second.id, new Set())).toBe(false);
    expect(isUnlocked(second.id, new Set([first.id]))).toBe(true);
    expect(isUnlocked(third.id, new Set([first.id]))).toBe(false);
  });

  it('unlockAll abre todo; ids desconocidos nunca', () => {
    expect(isUnlocked('w3-boss', new Set(), { unlockAll: true })).toBe(true);
    expect(isUnlocked('nope', new Set(), { unlockAll: true })).toBe(false);
  });

  it('nextLesson devuelve la primera sin aprobar', () => {
    expect(nextLesson(new Set())?.id).toBe('w0-read-1');
    expect(nextLesson(new Set(['w0-read-1']))?.id).toBe('w0-set-1');
    expect(nextLesson(new Set(LESSONS.map((l) => l.id)))).toBeNull();
  });
});

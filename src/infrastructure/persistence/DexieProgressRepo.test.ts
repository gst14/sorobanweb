import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttemptRecord } from '@/application/ports';
import { DexieProgressRepo, requestPersistentStorage } from './DexieProgressRepo';
import { SorobanDb } from './SorobanDb';

const attempt = (overrides: Partial<AttemptRecord> = {}): AttemptRecord => ({
  lessonId: 'w2-add',
  exerciseId: 'w2-add#1',
  at: 1000,
  correct: false,
  latencyMs: 3200,
  ruleUses: [{ op: 'add', rule: 'five', v: 3, d: 2, rod: 0, carry: false }],
  moves: [{ rod: 0, deck: 'earth', delta: 2, finger: 'unknown', at: 900 }],
  techniqueScore: null,
  extraMoves: 0,
  failedRule: { op: 'add', rule: 'five', v: 3, d: 2, rod: 0, carry: false },
  ...overrides,
});

describe('DexieProgressRepo', () => {
  let db: SorobanDb;
  let repo: DexieProgressRepo;

  beforeEach(() => {
    db = new SorobanDb(`test-${String(Math.random())}`);
    repo = new DexieProgressRepo(db);
  });

  afterEach(async () => {
    await db.delete();
  });

  it('guarda y lee intentos con sus ruleUses y moves', async () => {
    await repo.saveAttempt(attempt());
    await repo.saveAttempt(attempt({ exerciseId: 'w2-add#2', correct: true }));
    const rows = await db.attempts.where('lessonId').equals('w2-add').toArray();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ failedRule: { rule: 'five' }, latencyMs: 3200 });
    expect(rows[0]?.moves[0]).toMatchObject({ deck: 'earth', delta: 2 });
  });

  it('passedLessons devuelve las lecciones aprobadas al menos una vez', async () => {
    const base = { at: 1, correct: 10, total: 15, livesLost: 0 };
    await repo.saveLessonResult({ ...base, lessonId: 'w1-add', passed: false });
    await repo.saveLessonResult({ ...base, lessonId: 'w1-add', passed: true });
    await repo.saveLessonResult({ ...base, lessonId: 'w1-sub', passed: false });
    expect(await repo.passedLessons()).toEqual(new Set(['w1-add']));
  });
});

describe('requestPersistentStorage', () => {
  it('no vuelve a pedir si ya es persistente', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    expect(
      await requestPersistentStorage({ persisted: () => Promise.resolve(true), persist }),
    ).toBe(true);
    expect(persist).not.toHaveBeenCalled();
  });

  it('pide persistencia si todavía no la tiene', async () => {
    const storage = {
      persisted: () => Promise.resolve(false),
      persist: () => Promise.resolve(true),
    };
    expect(await requestPersistentStorage(storage)).toBe(true);
  });

  it('devuelve false si la API falla o no existe', async () => {
    const failing = {
      persisted: () => Promise.reject(new Error('SecurityError')),
      persist: () => Promise.resolve(true),
    };
    expect(await requestPersistentStorage(failing)).toBe(false);
    // jsdom no implementa navigator.storage
    expect(await requestPersistentStorage()).toBe(false);
  });
});

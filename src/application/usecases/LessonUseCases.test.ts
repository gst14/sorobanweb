import { beforeEach, describe, expect, it } from 'vitest';
import { toMove } from '@/domain';
import { FakeAudio, FakeClock, InMemoryProgressRepo, seededRng } from '../testing/fakes';
import { currentExercise } from './LessonSession';
import { createLessonUseCases } from './LessonUseCases';

describe('LessonUseCases', () => {
  let clock: FakeClock;
  let audio: FakeAudio;
  let progress: InMemoryProgressRepo;
  let lessons: ReturnType<typeof createLessonUseCases>;

  beforeEach(() => {
    clock = new FakeClock(1000);
    audio = new FakeAudio();
    progress = new InMemoryProgressRepo();
    lessons = createLessonUseCases({ clock, rng: seededRng, audio, progress });
  });

  it('flujo completo de una lección con fakes: suena, persiste intentos y resultado', async () => {
    let state = lessons.start('w1-add', 7);
    expect(state.startedAt).toBe(1000);

    while (state.status !== 'finished') {
      const ex = currentExercise(state);
      if (ex.kind !== 'operation') throw new Error('se esperaba una operación');
      for (const step of ex.steps)
        state = lessons.applyMove(state, toMove(step, step.rod, 'unknown', 0));
      clock.advance(2000);
      const submitted = await lessons.submit(state);
      expect(submitted.outcome.result.correct).toBe(true);
      state = await lessons.next(submitted.state);
    }

    expect(progress.attempts).toHaveLength(15);
    expect(progress.attempts[0]).toMatchObject({
      lessonId: 'w1-add',
      correct: true,
      latencyMs: 2000,
    });
    expect(progress.attempts[0]?.ruleUses.length).toBeGreaterThan(0);
    expect(progress.results).toEqual([
      { lessonId: 'w1-add', at: clock.now(), correct: 15, total: 15, livesLost: 0, passed: true },
    ]);
    expect(await progress.passedLessons()).toEqual(new Set(['w1-add']));
    expect(audio.played.filter((c) => c === 'correct')).toHaveLength(15);
    expect(audio.played.at(-1)).toBe('lessonComplete');
    expect(audio.played).toContain('bead');
  });

  it('un move inválido no suena ni cambia el estado', () => {
    const state = lessons.start('w1-sub', 7);
    const same = lessons.applyMove(state, {
      rod: 6,
      deck: 'earth',
      delta: -1,
      finger: 'unknown',
      at: 0,
    });
    expect(same).toBe(state);
    expect(audio.played).toEqual([]);
  });

  it('respuesta incorrecta: suena wrong y guarda el intento con la regla fallada', async () => {
    const state = lessons.start('w2-add', 7);
    const { outcome } = await lessons.submit(state);
    expect(outcome.result.correct).toBe(false);
    expect(audio.played).toEqual(['wrong']);
    expect(progress.attempts[0]?.failedRule?.rule).toBe('five');
  });

  it('lectura: guarda el intento sin ruleUses', async () => {
    const state = lessons.start('w0-read-1', 7);
    const ex = currentExercise(state);
    const { outcome } = await lessons.submit(state, ex.kind === 'read' ? ex.target : -1);
    expect(outcome.result.correct).toBe(true);
    expect(progress.attempts[0]?.ruleUses).toEqual([]);
  });

  it('jefe por tiempo: expire termina y persiste una sola vez', async () => {
    const state = lessons.start('w0-boss', 7);
    expect(await lessons.expire(state)).toBe(state);
    clock.advance(60_000);
    const expired = await lessons.expire(state);
    expect(expired.status).toBe('finished');
    expect(progress.results).toHaveLength(1);
    expect(progress.results[0]).toMatchObject({ lessonId: 'w0-boss', passed: false, total: 20 });
    await lessons.expire(expired);
    await lessons.next(expired);
    expect(progress.results).toHaveLength(1);
  });

  it('next sin terminar no persiste resultado', async () => {
    const state = lessons.start('w1-add', 7);
    const { state: fb } = await lessons.submit(state);
    const next = await lessons.next(fb);
    expect(next.status).toBe('playing');
    expect(progress.results).toEqual([]);
  });
});

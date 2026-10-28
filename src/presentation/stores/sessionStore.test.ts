import { beforeEach, describe, expect, it } from 'vitest';
import { createTestServices } from '@/app/testing/testServices';
import { currentExercise } from '@/application/usecases';
import { toMove } from '@/domain';

describe('sessionStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  const setup = () => {
    const services = createTestServices();
    const store = services.session;
    store.getState().start('w1-add', 7);
    return { services, store };
  };

  it('start, move, submit y next', async () => {
    const { store, services } = setup();
    const session = store.getState().session;
    if (!session) throw new Error('sin sesión');
    const ex = currentExercise(session);
    if (ex.kind !== 'operation') throw new Error('se esperaba operación');
    for (const step of ex.steps) store.getState().move(toMove(step, step.rod, 'unknown', 0));
    await store.getState().submit();
    expect(store.getState().lastOutcome?.result.correct).toBe(true);
    expect(store.getState().session?.status).toBe('feedback');
    await store.getState().next();
    expect(store.getState().session?.index).toBe(1);
    expect(store.getState().lastOutcome).toBeNull();
    expect(services.fakeProgress.attempts).toHaveLength(1);
  });

  it('submit fuera de juego no hace nada', async () => {
    const { store } = setup();
    await store.getState().submit();
    const after = store.getState().session;
    await store.getState().submit();
    expect(store.getState().session).toBe(after);
  });

  it('reset, resize y quit', () => {
    const { store } = setup();
    store.getState().move({ rod: 4, deck: 'heaven', delta: 1, finger: 'unknown', at: 0 });
    expect(store.getState().session?.moves).toHaveLength(1);
    store.getState().reset();
    expect(store.getState().session?.moves).toHaveLength(0);
    store.getState().resize(13);
    expect(store.getState().session?.soroban.rodCount).toBe(13);
    store.getState().quit();
    expect(store.getState().session).toBeNull();
  });

  it('sin sesión, las acciones no fallan', async () => {
    const store = createTestServices().session;
    store.getState().move({ rod: 0, deck: 'earth', delta: 1, finger: 'unknown', at: 0 });
    store.getState().reset();
    await store.getState().submit();
    await store.getState().next();
    await store.getState().expire();
    expect(store.getState().session).toBeNull();
  });
});

import { beforeEach, describe, expect, it } from 'vitest';
import { createTestServices } from './testing/testServices';

describe('assembleServices', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('el mute de las preferencias llega al audio', () => {
    const services = createTestServices();
    services.fakeAudio.play('bead');
    services.settings.getState().set({ muted: true });
    services.fakeAudio.play('bead');
    expect(services.fakeAudio.played).toEqual(['bead']);
  });

  it('al terminar una lección se refresca el progreso', async () => {
    const services = createTestServices();
    const session = services.session.getState();
    session.start('w0-boss', 7);
    services.fakeClock.advance(60_000);
    await services.session.getState().expire();
    expect(services.session.getState().session?.status).toBe('finished');
    await Promise.resolve();
    expect(services.progressStore.getState().loaded).toBe(true);
  });

  it('las preferencias persisten en el storage', () => {
    createTestServices().settings.getState().set({ showValue: true });
    expect(createTestServices().settings.getState().showValue).toBe(true);
  });
});

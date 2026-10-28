import type { AudioPort, Clock, ProgressRepo, RngFactory, VisionPort } from '@/application/ports';
import { createLessonUseCases } from '@/application/usecases';
import type { AppServices, InputFactories } from '@/presentation/services';
import { createProgressStore } from '@/presentation/stores/progressStore';
import { createSessionStore } from '@/presentation/stores/sessionStore';
import { createSettingsStore } from '@/presentation/stores/settingsStore';

export interface Ports {
  readonly audio: AudioPort;
  readonly vision: VisionPort;
  readonly progress: ProgressRepo;
  readonly clock: Clock;
  readonly rng: RngFactory;
  readonly inputs: InputFactories;
  readonly storage?: Storage;
}

/** Arma los casos de uso y los stores a partir de los puertos. */
export function assembleServices(ports: Ports): AppServices {
  const lessons = createLessonUseCases(ports);
  const progressStore = createProgressStore(ports.progress);
  const settings = createSettingsStore(ports.storage);
  const session = createSessionStore(lessons, () => void progressStore.getState().refresh());

  ports.audio.setMuted(settings.getState().muted);
  settings.subscribe((s) => {
    ports.audio.setMuted(s.muted);
  });

  return {
    audio: ports.audio,
    vision: ports.vision,
    progress: ports.progress,
    clock: ports.clock,
    inputs: ports.inputs,
    session,
    progressStore,
    settings,
  };
}

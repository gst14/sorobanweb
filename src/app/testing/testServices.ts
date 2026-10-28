import {
  FakeAudio,
  FakeCamera,
  FakeClock,
  InMemoryProgressRepo,
  seededRng,
} from '@/application/testing/fakes';
import { KeyboardInput, PointerInput } from '@/infrastructure/input';
import type { AppServices } from '@/presentation/services';
import { assembleServices } from '../assemble';

export interface TestServices extends AppServices {
  readonly fakeAudio: FakeAudio;
  readonly fakeCamera: FakeCamera;
  readonly fakeClock: FakeClock;
  readonly fakeProgress: InMemoryProgressRepo;
}

/** Servicios con puertos falsos y entradas reales, para tests de componentes. */
export function createTestServices(): TestServices {
  const fakeAudio = new FakeAudio();
  const fakeCamera = new FakeCamera();
  const fakeClock = new FakeClock(0);
  const fakeProgress = new InMemoryProgressRepo();
  const services = assembleServices({
    audio: fakeAudio,
    camera: fakeCamera,
    progress: fakeProgress,
    clock: fakeClock,
    rng: seededRng,
    storage: window.sessionStorage,
    inputs: {
      pointer: (element, getSoroban) => new PointerInput({ element, getSoroban, clock: fakeClock }),
      keyboard: (element, getSoroban, callbacks) =>
        new KeyboardInput({ element, getSoroban, clock: fakeClock, ...callbacks }),
    },
  });
  return { ...services, fakeAudio, fakeCamera, fakeClock, fakeProgress };
}

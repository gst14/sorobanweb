import { createRng } from '@/domain';
import { WebAudioPort } from '@/infrastructure/audio';
import { KeyboardInput, PointerInput } from '@/infrastructure/input';
import {
  DexieProgressRepo,
  SorobanDb,
  requestPersistentStorage,
} from '@/infrastructure/persistence';
import type { AppServices } from '@/presentation/services';
import { assembleServices } from './assemble';

/** Composition root: las implementaciones reales de cada puerto. */
export function createAppServices(): AppServices {
  const clock = { now: () => performance.now() };
  void requestPersistentStorage();
  return assembleServices({
    audio: new WebAudioPort(),
    progress: new DexieProgressRepo(new SorobanDb()),
    clock,
    rng: (seed) => createRng(seed ?? Math.floor(Math.random() * 2 ** 32)),
    inputs: {
      pointer: (element, getSoroban) => new PointerInput({ element, getSoroban, clock }),
      keyboard: (element, getSoroban, callbacks) =>
        new KeyboardInput({ element, getSoroban, clock, ...callbacks }),
    },
  });
}

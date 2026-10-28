import { createRng } from '@/domain';
import { WebAudioPort } from '@/infrastructure/audio';
import { KeyboardInput, PointerInput } from '@/infrastructure/input';
import {
  DexieProgressRepo,
  SorobanDb,
  requestPersistentStorage,
} from '@/infrastructure/persistence';
import { BrowserCamera, DelegatePreference, VisionService } from '@/infrastructure/vision';
import type { AppServices } from '@/presentation/services';
import { assembleServices } from './assemble';

/** Con el storage bloqueado (algunos modos privados), acceder a `localStorage` lanza. */
function localStorageOrUndefined(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Composition root: las implementaciones reales de cada puerto. */
export function createAppServices(): AppServices {
  const clock = { now: () => performance.now() };
  void requestPersistentStorage();
  return assembleServices({
    audio: new WebAudioPort(),
    vision: new VisionService({
      camera: new BrowserCamera({
        isSecureContext: window.isSecureContext,
        // En HTTP es undefined aunque los tipos del DOM digan lo contrario.
        mediaDevices: navigator.mediaDevices,
      }),
      preference: new DelegatePreference(localStorageOrUndefined()),
    }),
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

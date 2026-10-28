import { createContext, useContext } from 'react';
import { type StoreApi, useStore } from 'zustand';
import type { AudioPort, Clock, InputSource, ProgressRepo, VisionPort } from '@/application/ports';
import type { Soroban } from '@/domain';
import type { ProgressStore } from './stores/progressStore';
import type { SessionStore } from './stores/sessionStore';
import type { SettingsStore } from './stores/settingsStore';

export interface KeyboardCallbacks {
  readonly onSelect?: (rod: number) => void;
  readonly onClear?: () => void;
}

/** Fábricas de entradas: la presentación no conoce las implementaciones (infrastructure). */
export interface InputFactories {
  pointer(element: Element, getSoroban: () => Soroban): InputSource;
  keyboard(
    element: EventTarget,
    getSoroban: () => Soroban,
    callbacks: KeyboardCallbacks,
  ): InputSource;
}

/** Todo lo que la UI necesita, armado en el composition root (src/app). */
export interface AppServices {
  readonly audio: AudioPort;
  readonly vision: VisionPort;
  readonly progress: ProgressRepo;
  readonly clock: Clock;
  readonly inputs: InputFactories;
  readonly session: StoreApi<SessionStore>;
  readonly progressStore: StoreApi<ProgressStore>;
  readonly settings: StoreApi<SettingsStore>;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices requiere <ServicesProvider>');
  return services;
}

export const useSession = <T>(selector: (s: SessionStore) => T): T =>
  useStore(useServices().session, selector);

export const useProgress = <T>(selector: (s: ProgressStore) => T): T =>
  useStore(useServices().progressStore, selector);

export const useSettings = <T>(selector: (s: SettingsStore) => T): T =>
  useStore(useServices().settings, selector);

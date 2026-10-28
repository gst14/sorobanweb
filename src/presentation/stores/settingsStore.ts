import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';

export interface Settings {
  readonly muted: boolean;
  /** Mostrar el valor numérico del soroban (práctica). */
  readonly showValue: boolean;
  /** Interruptor oculto para probar: abre todas las lecciones. */
  readonly unlockAll: boolean;
}

export interface SettingsStore extends Settings {
  set(patch: Partial<Settings>): void;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, showValue: false, unlockAll: false };

/** Preferencias en localStorage: son conveniencias, no progreso. */
export const createSettingsStore = (storage?: Storage) =>
  createStore<SettingsStore>()(
    persist(
      (set) => ({
        ...DEFAULT_SETTINGS,
        set: (patch) => {
          set(patch);
        },
      }),
      {
        name: 'soroban-settings',
        version: 1,
        storage: createJSONStorage(() => storage ?? localStorage),
        partialize: ({ muted, showValue, unlockAll }) => ({ muted, showValue, unlockAll }),
      },
    ),
  );

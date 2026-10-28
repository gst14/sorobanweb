import { createJSONStorage, persist } from 'zustand/middleware';
import { createStore } from 'zustand/vanilla';
import type { GestureMode } from '@/application/ports';

/** Cómo se mueven las cuentas en las lecciones: con el dedo en la pantalla o con la cámara. */
export type InputMode = 'touch' | GestureMode;

export interface Settings {
  readonly muted: boolean;
  /** Mostrar el valor numérico del soroban (práctica). */
  readonly showValue: boolean;
  /** Interruptor oculto para probar: abre todas las lecciones. */
  readonly unlockAll: boolean;
  readonly inputMode: InputMode;
}

export interface SettingsStore extends Settings {
  readonly set: (patch: Partial<Settings>) => void;
}

export const DEFAULT_SETTINGS: Settings = {
  muted: false,
  showValue: false,
  unlockAll: false,
  inputMode: 'touch',
};

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
        partialize: ({ muted, showValue, unlockAll, inputMode }) => ({
          muted,
          showValue,
          unlockAll,
          inputMode,
        }),
      },
    ),
  );

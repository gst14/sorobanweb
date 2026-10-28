import { createStore } from 'zustand/vanilla';
import type { ProgressRepo } from '@/application/ports';

export interface ProgressStore {
  readonly passed: ReadonlySet<string>;
  readonly loaded: boolean;
  readonly refresh: () => Promise<void>;
}

export const createProgressStore = (repo: ProgressRepo) =>
  createStore<ProgressStore>()((set) => ({
    passed: new Set(),
    loaded: false,
    refresh: async () => {
      set({ passed: await repo.passedLessons(), loaded: true });
    },
  }));

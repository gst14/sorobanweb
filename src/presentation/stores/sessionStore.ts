import { createStore } from 'zustand/vanilla';
import {
  type ExerciseOutcome,
  type LessonSessionState,
  type LessonUseCases,
  resetExercise,
  resizeSession,
} from '@/application/usecases';
import type { Move } from '@/domain';

export interface SessionStore {
  readonly session: LessonSessionState | null;
  readonly lastOutcome: ExerciseOutcome | null;
  start(lessonId: string, rodCount: number): void;
  move(move: Move): void;
  reset(): void;
  resize(rodCount: number): void;
  submit(typed?: number): Promise<void>;
  next(): Promise<void>;
  expire(): Promise<void>;
  quit(): void;
}

/** Estado de la lección en curso. Las reglas viven en los casos de uso; acá solo se guardan. */
export const createSessionStore = (lessons: LessonUseCases, onFinished?: () => void) =>
  createStore<SessionStore>()((set, get) => {
    const withSession = (fn: (s: LessonSessionState) => LessonSessionState) => {
      const { session } = get();
      if (session) set({ session: fn(session) });
    };
    const settle = (before: LessonSessionState, after: LessonSessionState) => {
      if (after.status === 'finished' && before.status !== 'finished') onFinished?.();
    };

    return {
      session: null,
      lastOutcome: null,
      start: (lessonId, rodCount) => {
        set({ session: lessons.start(lessonId, rodCount), lastOutcome: null });
      },
      move: (move) => {
        withSession((s) => lessons.applyMove(s, move));
      },
      reset: () => {
        withSession(resetExercise);
      },
      resize: (rodCount) => {
        withSession((s) => resizeSession(s, rodCount));
      },
      submit: async (typed) => {
        const { session } = get();
        if (session?.status !== 'playing') return;
        const { state, outcome } = await lessons.submit(session, typed);
        set({ session: state, lastOutcome: outcome });
      },
      next: async () => {
        const { session } = get();
        if (!session) return;
        const next = await lessons.next(session);
        set({ session: next, lastOutcome: next.status === 'playing' ? null : get().lastOutcome });
        settle(session, next);
      },
      expire: async () => {
        const { session } = get();
        if (!session) return;
        const next = await lessons.expire(session);
        set({ session: next });
        settle(session, next);
      },
      quit: () => {
        set({ session: null, lastOutcome: null });
      },
    };
  });

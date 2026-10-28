import { LESSONS, type Lesson } from './worlds';

export interface LessonScore {
  readonly correct: number;
  readonly total: number;
  /** Vidas perdidas (solo jefes con vidas). */
  readonly livesLost?: number;
}

/** Aprueba si alcanza la proporción de aciertos y, en jefes con vidas, no las agotó todas. */
export function isLessonPassed(lesson: Lesson, score: LessonScore): boolean {
  if (score.total <= 0) return false;
  const lives = lesson.boss?.lives;
  if (lives !== undefined && (score.livesLost ?? 0) >= lives) return false;
  return score.correct / score.total >= lesson.passRatio;
}

/**
 * Desbloqueo lineal: la primera lección está abierta y cada una se abre al aprobar la anterior.
 * `unlockAll` abre todo (interruptor oculto para probar).
 */
export function isUnlocked(
  lessonId: string,
  passed: ReadonlySet<string>,
  options: { readonly unlockAll?: boolean } = {},
): boolean {
  const index = LESSONS.findIndex((l) => l.id === lessonId);
  if (index < 0) return false;
  if (options.unlockAll === true || index === 0) return true;
  const previous = LESSONS[index - 1];
  return previous !== undefined && passed.has(previous.id);
}

/** Primera lección sin aprobar, o null si están todas aprobadas. */
export const nextLesson = (passed: ReadonlySet<string>): Lesson | null =>
  LESSONS.find((l) => !passed.has(l.id)) ?? null;

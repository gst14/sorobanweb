import type { Move, RuleUse } from '@/domain';

export interface AttemptRecord {
  readonly lessonId: string;
  readonly exerciseId: string;
  readonly at: number;
  readonly correct: boolean;
  readonly latencyMs: number;
  readonly ruleUses: readonly RuleUse[];
  readonly moves: readonly Move[];
  readonly techniqueScore: number | null;
  readonly extraMoves: number;
  readonly failedRule: RuleUse | null;
}

export interface LessonResultRecord {
  readonly lessonId: string;
  readonly at: number;
  readonly correct: number;
  readonly total: number;
  readonly livesLost: number;
  readonly passed: boolean;
}

export interface ProgressRepo {
  saveAttempt(attempt: AttemptRecord): Promise<void>;
  saveLessonResult(result: LessonResultRecord): Promise<void>;
  /** Ids de lecciones aprobadas al menos una vez. */
  passedLessons(): Promise<ReadonlySet<string>>;
}

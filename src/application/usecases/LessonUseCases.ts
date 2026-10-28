import { type Move, isLessonPassed, lessonById } from '@/domain';
import type { AudioPort } from '../ports/AudioPort';
import type { Clock } from '../ports/Clock';
import type { ProgressRepo } from '../ports/ProgressRepo';
import type { RngFactory } from '../ports/RngFactory';
import {
  type ExerciseOutcome,
  type LessonSessionState,
  applyMoveToSession,
  nextExercise,
  expireIfTimeUp,
  sessionScore,
  startSession,
  submitAnswer,
} from './LessonSession';

export interface LessonDeps {
  readonly clock: Clock;
  readonly rng: RngFactory;
  readonly audio: AudioPort;
  readonly progress: ProgressRepo;
}

export interface LessonUseCases {
  /** StartLesson */
  start(lessonId: string, rodCount: number): LessonSessionState;
  /** ApplyMove: aplica si es válido (suena el clac) o descarta sin lanzar. */
  applyMove(state: LessonSessionState, move: Move): LessonSessionState;
  /** SubmitAnswer: valida, suena, persiste el intento. */
  submit(
    state: LessonSessionState,
    typed?: number,
  ): Promise<{ state: LessonSessionState; outcome: ExerciseOutcome }>;
  /** Avanza; si la lección termina, persiste el resultado. */
  next(state: LessonSessionState): Promise<LessonSessionState>;
  /** Termina la lección si se agotó el tiempo del jefe, y persiste el resultado. */
  expire(state: LessonSessionState): Promise<LessonSessionState>;
}

export function createLessonUseCases(deps: LessonDeps): LessonUseCases {
  const { clock, rng, audio, progress } = deps;

  async function recordIfFinished(
    before: LessonSessionState,
    after: LessonSessionState,
    now: number,
  ): Promise<LessonSessionState> {
    if (after.status !== 'finished' || before.status === 'finished') return after;
    const score = sessionScore(after);
    await progress.saveLessonResult({
      lessonId: after.lesson.id,
      at: now,
      correct: score.correct,
      total: score.total,
      livesLost: after.livesLost,
      passed: isLessonPassed(after.lesson, score),
    });
    audio.play('lessonComplete');
    return after;
  }

  return {
    start(lessonId, rodCount) {
      return startSession(lessonById(lessonId), rng(), clock.now(), rodCount);
    },

    applyMove(state, move) {
      const next = applyMoveToSession(state, move);
      if (next !== state) audio.play('bead');
      return next;
    },

    async submit(state, typed) {
      const now = clock.now();
      const submitted = submitAnswer(state, now, typed);
      const { exercise, result, latencyMs } = submitted.outcome;
      audio.play(result.correct ? 'correct' : 'wrong');
      await progress.saveAttempt({
        lessonId: state.lesson.id,
        exerciseId: exercise.id,
        at: now,
        correct: result.correct,
        latencyMs,
        ruleUses: exercise.kind === 'operation' ? exercise.ruleUses : [],
        moves: state.moves,
        techniqueScore: result.techniqueScore,
        extraMoves: result.extraMoves,
        failedRule: result.failedRule,
      });
      return submitted;
    },

    async next(state) {
      const now = clock.now();
      return recordIfFinished(state, nextExercise(state, now), now);
    },

    async expire(state) {
      const now = clock.now();
      return recordIfFinished(state, expireIfTimeUp(state, now), now);
    },
  };
}

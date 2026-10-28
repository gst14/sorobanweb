import {
  type Exercise,
  type Lesson,
  type LessonScore,
  type Move,
  type Rng,
  Soroban,
  type ValidationResult,
  generateLesson,
  initialSoroban,
  validate,
} from '@/domain';

export type SessionStatus = 'playing' | 'feedback' | 'finished';

export interface ExerciseOutcome {
  readonly exercise: Exercise;
  readonly result: ValidationResult;
  readonly latencyMs: number;
}

/** Estado inmutable de una lección en curso. */
export interface LessonSessionState {
  readonly lesson: Lesson;
  readonly exercises: readonly Exercise[];
  readonly index: number;
  readonly soroban: Soroban;
  readonly moves: readonly Move[];
  readonly status: SessionStatus;
  readonly outcomes: readonly ExerciseOutcome[];
  readonly livesLost: number;
  readonly startedAt: number;
  readonly exerciseStartedAt: number;
}

export function startSession(
  lesson: Lesson,
  rng: Rng,
  now: number,
  rodCount: number,
): LessonSessionState {
  const exercises = generateLesson(lesson, rng);
  const first = exercises[0];
  if (!first) throw new RangeError(`La lección ${lesson.id} no tiene ejercicios`);
  return Object.freeze({
    lesson,
    exercises,
    index: 0,
    soroban: initialSoroban(first, rodCount),
    moves: Object.freeze([]),
    status: 'playing',
    outcomes: Object.freeze([]),
    livesLost: 0,
    startedAt: now,
    exerciseStartedAt: now,
  });
}

export function currentExercise(state: LessonSessionState): Exercise {
  const exercise = state.exercises[state.index];
  if (!exercise) throw new RangeError('No hay ejercicio actual');
  return exercise;
}

/** ¿Se pueden mover cuentas? No en lectura (el soroban es de solo lectura) ni fuera de juego. */
export const acceptsMoves = (state: LessonSessionState): boolean =>
  state.status === 'playing' && currentExercise(state).kind !== 'read';

/** Aplica un movimiento si es válido; si no, devuelve el mismo estado. */
export function applyMoveToSession(state: LessonSessionState, move: Move): LessonSessionState {
  if (!acceptsMoves(state) || !state.soroban.canApply(move)) return state;
  return Object.freeze({
    ...state,
    soroban: state.soroban.apply(move),
    moves: Object.freeze([...state.moves, move]),
  });
}

/** Vuelve el soroban del ejercicio actual a su estado inicial (botón "borrar"). */
export function resetExercise(state: LessonSessionState): LessonSessionState {
  if (!acceptsMoves(state)) return state;
  return Object.freeze({
    ...state,
    soroban: initialSoroban(currentExercise(state), state.soroban.rodCount),
    moves: Object.freeze([]),
  });
}

/**
 * Entrega la respuesta del ejercicio actual. En lectura se pasa el número tipeado;
 * en el resto se valida el soroban.
 */
export function submitAnswer(
  state: LessonSessionState,
  now: number,
  typed?: number,
): { readonly state: LessonSessionState; readonly outcome: ExerciseOutcome } {
  if (state.status !== 'playing') throw new Error('No hay un ejercicio en juego');
  const exercise = currentExercise(state);
  const result =
    exercise.kind === 'read'
      ? validate(exercise, { kind: 'number', value: typed ?? Number.NaN })
      : validate(exercise, { kind: 'beads', soroban: state.soroban, moves: state.moves });
  const outcome: ExerciseOutcome = Object.freeze({
    exercise,
    result,
    latencyMs: now - state.exerciseStartedAt,
  });
  const next: LessonSessionState = Object.freeze({
    ...state,
    outcomes: Object.freeze([...state.outcomes, outcome]),
    livesLost: state.livesLost + (result.correct ? 0 : 1),
    status: 'feedback',
  });
  return { state: next, outcome };
}

/** Termina la lección si se agotó el tiempo del jefe. */
export const expireIfTimeUp = (state: LessonSessionState, now: number): LessonSessionState =>
  state.status !== 'finished' && remainingMs(state, now) === 0 ? finish(state) : state;

/** Pasa al siguiente ejercicio, o termina la lección (sin ejercicios, sin vidas o sin tiempo). */
export function nextExercise(state: LessonSessionState, now: number): LessonSessionState {
  if (state.status !== 'feedback') return state;
  const index = state.index + 1;
  const exercise = state.exercises[index];
  if (!exercise || isOver(state, now)) return finish(state);
  return Object.freeze({
    ...state,
    index,
    soroban: initialSoroban(exercise, state.soroban.rodCount),
    moves: Object.freeze([]),
    status: 'playing',
    exerciseStartedAt: now,
  });
}

/** Cambia la cantidad de varillas (rotación) sin alterar el valor. */
export const resizeSession = (state: LessonSessionState, rodCount: number): LessonSessionState =>
  state.soroban.rodCount === rodCount
    ? state
    : Object.freeze({
        ...state,
        soroban: Soroban.fromNumber(state.soroban.toNumber(), rodCount, state.soroban.unitRod),
      });

export function remainingMs(state: LessonSessionState, now: number): number | null {
  const limit = state.lesson.boss?.timeLimitMs;
  return limit === undefined ? null : Math.max(0, limit - (now - state.startedAt));
}

export const sessionScore = (state: LessonSessionState): LessonScore => ({
  correct: state.outcomes.filter((o) => o.result.correct).length,
  total: state.lesson.exerciseCount,
  livesLost: state.livesLost,
});

function isOver(state: LessonSessionState, now: number): boolean {
  const lives = state.lesson.boss?.lives;
  return (lives !== undefined && state.livesLost >= lives) || remainingMs(state, now) === 0;
}

const finish = (state: LessonSessionState): LessonSessionState =>
  Object.freeze({ ...state, status: 'finished' });

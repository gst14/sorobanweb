import { useEffect, useRef, useState } from 'react';
import {
  type LessonSessionState,
  currentExercise,
  remainingMs,
  sessionScore,
} from '@/application/usecases';
import { expectedValue, isLessonPassed } from '@/domain';
import { NumericKeypad } from '../../components/NumericKeypad';
import { InteractiveSoroban } from '../../components/soroban/InteractiveSoroban';
import { useRodLayout } from '../../hooks/useRodLayout';
import { useServices, useSession, useSettings } from '../../services';
import { exercisePrompt, failedRules, ruleHint } from './prompt';
import './LessonScreen.css';

export interface LessonScreenProps {
  readonly lessonId: string;
  readonly onExit: () => void;
}

/** Tiempo de feedback antes de avanzar solo en jefes contra reloj. */
const TIMED_FEEDBACK_MS = 500;

export function LessonScreen({ lessonId, onExit }: LessonScreenProps) {
  const { session: store } = useServices();
  const session = useSession((s) => s.session);
  const rodCount = useRodLayout();
  // La lección arranca con las varillas del momento; las rotaciones se manejan con resize.
  const initialRods = useRef(rodCount);

  useEffect(() => {
    store.getState().start(lessonId, initialRods.current);
    return () => {
      store.getState().quit();
    };
  }, [lessonId, store]);

  useEffect(() => {
    store.getState().resize(rodCount);
  }, [rodCount, store]);

  if (session?.lesson.id !== lessonId) return null;

  return (
    <main className="screen screen--lesson">
      <LessonHeader session={session} onExit={onExit} />
      {session.status === 'finished' ? (
        <LessonResult
          session={session}
          onRetry={() => {
            store.getState().start(lessonId, rodCount);
          }}
          onExit={onExit}
        />
      ) : (
        <ExerciseView key={currentExercise(session).id} session={session} />
      )}
    </main>
  );
}

function MuteButton() {
  const muted = useSettings((s) => s.muted);
  const set = useSettings((s) => s.set);
  return (
    <button
      type="button"
      className="ghost"
      aria-pressed={muted}
      aria-label="Silenciar sonidos"
      onClick={() => {
        set({ muted: !muted });
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

function LessonHeader({ session, onExit }: { session: LessonSessionState; onExit: () => void }) {
  const { clock, session: store } = useServices();
  const lives = session.lesson.boss?.lives;
  const timed = session.lesson.boss?.timeLimitMs !== undefined;
  const [left, setLeft] = useState(() => remainingMs(session, clock.now()));

  useEffect(() => {
    if (!timed || session.status === 'finished') return;
    const id = window.setInterval(() => {
      const ms = remainingMs(store.getState().session ?? session, clock.now());
      setLeft(ms);
      if (ms === 0) void store.getState().expire();
    }, 250);
    return () => {
      window.clearInterval(id);
    };
  }, [timed, session, store, clock]);

  const position = Math.min(session.index + 1, session.exercises.length);
  return (
    <header className="lesson-header">
      <button type="button" className="ghost" onClick={onExit} aria-label="Salir de la lección">
        ←
      </button>
      <h1>{session.lesson.title}</h1>
      <div className="lesson-header__stats">
        <span aria-label={`Ejercicio ${String(position)} de ${String(session.exercises.length)}`}>
          {position}/{session.exercises.length}
        </span>
        {lives !== undefined && (
          <span aria-label={`${String(lives - session.livesLost)} vidas`}>
            {'❤'.repeat(Math.max(0, lives - session.livesLost))}
          </span>
        )}
        {timed && left !== null && (
          <span role="timer" aria-label="Tiempo restante">
            {Math.ceil(left / 1000)} s
          </span>
        )}
        <MuteButton />
      </div>
      <progress max={session.exercises.length} value={session.outcomes.length} />
    </header>
  );
}

function ExerciseView({ session }: { session: LessonSessionState }) {
  const { session: store } = useServices();
  const showValue = useSettings((s) => s.showValue);
  const lastOutcome = useSession((s) => s.lastOutcome);
  const [typed, setTyped] = useState('');
  const exercise = currentExercise(session);
  const prompt = exercisePrompt(exercise);
  const playing = session.status === 'playing';
  const isRead = exercise.kind === 'read';
  const timed = session.lesson.boss?.timeLimitMs !== undefined;

  useEffect(() => {
    if (session.status !== 'feedback' || !timed) return;
    const id = window.setTimeout(() => void store.getState().next(), TIMED_FEEDBACK_MS);
    return () => {
      window.clearTimeout(id);
    };
  }, [session.status, timed, store]);

  const submit = () => void store.getState().submit(isRead ? Number(typed) : undefined);

  return (
    <section className="exercise" aria-live="polite">
      <div className="exercise__prompt">
        <p>{prompt.title}</p>
        {prompt.expression !== undefined && (
          <p className="exercise__expression">{prompt.expression}</p>
        )}
      </div>

      <div className="exercise__board">
        <InteractiveSoroban
          soroban={session.soroban}
          readOnly={!playing || isRead}
          showValue={showValue && !isRead}
          onMove={(m) => {
            store.getState().move(m);
          }}
          onClear={() => {
            store.getState().reset();
          }}
        />
      </div>

      {playing && isRead && <NumericKeypad value={typed} onChange={setTyped} onSubmit={submit} />}

      {playing && !isRead && (
        <div className="exercise__actions">
          <button
            type="button"
            className="ghost"
            onClick={() => {
              store.getState().reset();
            }}
          >
            Borrar
          </button>
          <button type="button" className="primary" onClick={submit}>
            Listo
          </button>
        </div>
      )}

      {session.status === 'feedback' && lastOutcome && (
        <Feedback
          correct={lastOutcome.result.correct}
          expected={expectedValue(lastOutcome.exercise)}
          hint={lastOutcome.result.failedRule ? ruleHint(lastOutcome.result.failedRule) : null}
          extraMoves={lastOutcome.result.extraMoves}
          onNext={timed ? null : () => void store.getState().next()}
        />
      )}
    </section>
  );
}

interface FeedbackProps {
  readonly correct: boolean;
  readonly expected: number;
  readonly hint: string | null;
  readonly extraMoves: number;
  readonly onNext: (() => void) | null;
}

/** El texto del feedback también funciona como subtítulo de los sonidos. */
function Feedback({ correct, expected, hint, extraMoves, onNext }: FeedbackProps) {
  return (
    <div className={`feedback feedback--${correct ? 'ok' : 'error'}`} role="status">
      <p className="feedback__title">{correct ? '✓ ¡Correcto!' : `✗ Era ${String(expected)}`}</p>
      {hint && <p className="feedback__hint">{hint}</p>}
      {correct && extraMoves > 0 && (
        <p className="muted">
          {extraMoves === 1
            ? 'Usaste 1 movimiento de más.'
            : `Usaste ${String(extraMoves)} movimientos de más.`}
        </p>
      )}
      {onNext && (
        <button type="button" className="primary" onClick={onNext} autoFocus>
          Seguir
        </button>
      )}
    </div>
  );
}

function LessonResult({
  session,
  onRetry,
  onExit,
}: {
  session: LessonSessionState;
  onRetry: () => void;
  onExit: () => void;
}) {
  const score = sessionScore(session);
  const passed = isLessonPassed(session.lesson, score);
  const failed = failedRules(session.outcomes);
  return (
    <section className="result" role="status">
      <h2>{passed ? '¡Lección aprobada!' : 'Seguí practicando'}</h2>
      <p className="result__score">
        {score.correct} de {score.total} correctas
      </p>
      {failed.length > 0 && (
        <>
          <h3>Reglas para repasar</h3>
          <ul>
            {failed.map((rule) => (
              <li key={`${rule.op}:${rule.rule}:${String(rule.d)}`}>{ruleHint(rule)}</li>
            ))}
          </ul>
        </>
      )}
      <div className="exercise__actions">
        <button type="button" className="ghost" onClick={onRetry}>
          Repetir
        </button>
        <button type="button" className="primary" onClick={onExit}>
          Volver a los mundos
        </button>
      </div>
    </section>
  );
}

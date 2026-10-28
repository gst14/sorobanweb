import { useEffect } from 'react';
import { WORLDS, isUnlocked } from '@/domain';
import { useProgress, useServices, useSettings } from '../services';

export interface WorldListScreenProps {
  readonly onOpenLesson: (lessonId: string) => void;
  readonly onOpenCamera: () => void;
}

export function WorldListScreen({ onOpenLesson, onOpenCamera }: WorldListScreenProps) {
  const { progressStore } = useServices();
  const passed = useProgress((s) => s.passed);
  const unlockAll = useSettings((s) => s.unlockAll);
  const muted = useSettings((s) => s.muted);
  const showValue = useSettings((s) => s.showValue);
  const setSettings = useSettings((s) => s.set);

  useEffect(() => {
    void progressStore.getState().refresh();
  }, [progressStore]);

  return (
    <main className="screen">
      <h1>Mundos</h1>
      {WORLDS.map((world) => (
        <section key={world.id} className="world" aria-labelledby={`world-${String(world.id)}`}>
          <h2 id={`world-${String(world.id)}`}>
            {world.id} · {world.title} <small className="muted">{world.rank}</small>
          </h2>
          <ul className="lessons">
            {world.lessons.map((lesson) => {
              const open = isUnlocked(lesson.id, passed, { unlockAll });
              const done = passed.has(lesson.id);
              return (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className={`lesson${done ? ' lesson--done' : ''}${lesson.boss ? ' lesson--boss' : ''}`}
                    disabled={!open}
                    onClick={() => {
                      onOpenLesson(lesson.id);
                    }}
                  >
                    <span aria-hidden="true">{done ? '✓' : open ? '▶' : '🔒'}</span>
                    <span>{lesson.title}</span>
                    {done && <span className="visually-hidden">(aprobada)</span>}
                    {!open && <span className="visually-hidden">(bloqueada)</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <button type="button" className="ghost camera-entry" onClick={onOpenCamera}>
        📷 Modo cámara (beta)
      </button>
      <details className="options">
        <summary>Opciones</summary>
        <label>
          <input
            type="checkbox"
            checked={muted}
            onChange={(e) => {
              setSettings({ muted: e.target.checked });
            }}
          />
          Silenciar sonidos
        </label>
        <label>
          <input
            type="checkbox"
            checked={showValue}
            onChange={(e) => {
              setSettings({ showValue: e.target.checked });
            }}
          />
          Mostrar el valor del soroban
        </label>
        <label>
          <input
            type="checkbox"
            checked={unlockAll}
            onChange={(e) => {
              setSettings({ unlockAll: e.target.checked });
            }}
          />
          Desbloquear todo (pruebas)
        </label>
      </details>
    </main>
  );
}

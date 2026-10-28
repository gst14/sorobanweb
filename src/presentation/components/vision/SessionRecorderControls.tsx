import { useEffect, useRef, useState } from 'react';
import type { TraceListener } from '@/application/ports';
import { SessionRecorder, recordingFileName } from '@/application/vision';

export interface SessionRecorderControlsProps {
  readonly setTraceListener: (listener: TraceListener | null) => void;
  /** Para los tests; por defecto, la fecha actual. */
  readonly now?: () => Date;
}

function download(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Solo en desarrollo: graba los frames de la cámara y los movimientos que reconoce el motor, y
 * los descarga como JSON para usarlos de test de regresión (ver `gesture/recordings/README.md`).
 * Si el panel se desmonta (cámara apagada o recalibración), la grabación se descarta.
 */
export function SessionRecorderControls({
  setTraceListener,
  now = () => new Date(),
}: SessionRecorderControlsProps) {
  const recorderRef = useRef<SessionRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [full, setFull] = useState(false);
  const [label, setLabel] = useState('');
  const listenRef = useRef(setTraceListener);

  useEffect(() => {
    listenRef.current = setTraceListener;
  });

  // Al desmontar, dejar de escuchar; `listenRef` siempre tiene la última función.
  useEffect(
    () => () => {
      if (recorderRef.current) listenRef.current(null);
    },
    [],
  );

  const start = () => {
    const recorder = new SessionRecorder();
    recorderRef.current = recorder;
    setSeconds(0);
    setFull(false);
    setRecording(true);
    setTraceListener((trace) => {
      recorder.add(trace);
      // Re-renderiza una vez por segundo, no en cada frame.
      setSeconds(Math.floor(recorder.durationMs / 1000));
      setFull(recorder.full);
    });
  };

  const stop = () => {
    const recorder = recorderRef.current;
    setTraceListener(null);
    recorderRef.current = null;
    setRecording(false);
    if (!recorder || recorder.frameCount === 0) return;
    const result = recorder.toRecording(label.trim(), now());
    download(recordingFileName(result), `${JSON.stringify(result)}\n`);
  };

  return (
    <div className="recorder" aria-label="Grabador de gestos (desarrollo)" role="group">
      <input
        type="text"
        aria-label="Qué vas a grabar"
        placeholder="Qué vas a grabar"
        value={label}
        disabled={recording}
        onChange={(e) => {
          setLabel(e.target.value);
        }}
      />
      {recording ? (
        <>
          <button type="button" className="ghost" onClick={stop}>
            Detener y descargar
          </button>
          <span role="status">{full ? 'Grabación llena' : `Grabando · ${String(seconds)} s`}</span>
        </>
      ) : (
        <button type="button" className="ghost" onClick={start}>
          Grabar
        </button>
      )}
    </div>
  );
}

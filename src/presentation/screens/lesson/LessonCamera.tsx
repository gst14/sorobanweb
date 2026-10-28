import type { GestureMode } from '@/application/ports';
import { Soroban } from '@/domain';
import {
  CalibrationPrompt,
  CameraErrorPanel,
  CameraStarting,
  CameraView,
  QualityIndicator,
} from '../../components/vision/CameraParts';
import { SessionRecorderControls } from '../../components/vision/SessionRecorderControls';
import { useVisionCamera } from '../../hooks/useVisionCamera';
import { useServices, useSettings } from '../../services';

export interface LessonCameraProps {
  readonly mode: GestureMode;
  readonly rodCount: number;
}

/**
 * La cámara dentro de la lección: los gestos mueven el soroban del ejercicio igual que el
 * táctil. Vive por encima de cada ejercicio, así la cámara no se reinicia entre uno y otro.
 */
export function LessonCamera({ mode, rodCount }: LessonCameraProps) {
  const { session: store } = useServices();
  const setSettings = useSettings((s) => s.set);
  const toTouch = () => {
    setSettings({ inputMode: 'touch' });
  };
  const camera = useVisionCamera({
    mode,
    rodCount,
    getSoroban: () => store.getState().session?.soroban ?? Soroban.create(rodCount),
    onMove: (move) => {
      store.getState().move(move);
    },
  });
  const { state, handSeen, calibrating, videoRef, overlayRef } = camera;
  const showVideo = state.status === 'starting' || state.status === 'ready';

  const turnOffButton = (
    <button type="button" className="ghost" onClick={camera.turnOff}>
      Apagar cámara
    </button>
  );

  return (
    <section className="lesson-camera" aria-label="Cámara">
      <CameraView videoRef={videoRef} overlayRef={overlayRef} visible={showVideo} />

      {state.status === 'idle' && (
        <div className="lesson-camera__idle">
          <p className="muted">La imagen se procesa en este dispositivo y no sale de él.</p>
          <button type="button" className="primary" onClick={() => void camera.activate()}>
            Activar cámara
          </button>
        </div>
      )}

      {state.status === 'starting' && <CameraStarting phase={state.phase} />}

      {state.status === 'ready' && calibrating && (
        <CalibrationPrompt
          view={calibrating}
          handSeen={handSeen}
          onCancel={camera.cancelCalibration}
        >
          {turnOffButton}
        </CalibrationPrompt>
      )}

      {state.status === 'ready' && !calibrating && (
        <div className="lesson-camera__ready">
          {!handSeen && <p className="muted">Acercá una mano a la cámara.</p>}
          <QualityIndicator quality={camera.quality} onTouch={toTouch} />
          <div className="camera__actions">
            <button type="button" className="ghost" onClick={camera.recalibrate}>
              Recalibrar
            </button>
            {turnOffButton}
          </div>
          {import.meta.env.DEV && (
            <SessionRecorderControls setTraceListener={camera.setTraceListener} />
          )}
        </div>
      )}

      {state.status === 'error' && (
        <CameraErrorPanel
          error={state.error}
          onTouch={toTouch}
          onRetry={() => void camera.activate()}
        />
      )}
    </section>
  );
}

import { useRef, useState } from 'react';
import { Soroban } from '@/domain';
import { InputModeSelector } from '../components/InputModeSelector';
import { SorobanSvg } from '../components/soroban/SorobanSvg';
import {
  CalibrationPrompt,
  CameraErrorPanel,
  CameraStarting,
  CameraView,
  QualityIndicator,
} from '../components/vision/CameraParts';
import { useVisionCamera } from '../hooks/useVisionCamera';
import { useServices, useSettings } from '../services';
import './CameraScreen.css';

/** Soroban de práctica: 7 varillas, para que en el aire cada una tenga ancho de sobra. */
const ROD_COUNT = 7;
const EMPTY_PRACTICE = Soroban.create(ROD_COUNT);

/**
 * "Activar modo cámara": explica qué se hace con la imagen, pide la cámara solo después del
 * tap y, ante cualquier error, ofrece volver al modo táctil. Con la cámara andando, pide
 * calibrar si no hay calibración para la orientación de la imagen y después mueve un soroban
 * de práctica con los gestos.
 */
export function CameraScreen({ onExit }: { onExit: () => void }) {
  const { vision, audio } = useServices();
  const inputMode = useSettings((s) => s.inputMode);
  const setSettings = useSettings((s) => s.set);
  const mode = inputMode === 'touch' ? 'push' : inputMode;
  const practiceRef = useRef(EMPTY_PRACTICE);
  const [practice, setPractice] = useState(EMPTY_PRACTICE);
  const [compat, setCompat] = useState(() => vision.compatibilityMode());

  const setPracticeSoroban = (soroban: Soroban) => {
    practiceRef.current = soroban;
    setPractice(soroban);
  };

  const camera = useVisionCamera({
    mode,
    rodCount: ROD_COUNT,
    getSoroban: () => practiceRef.current,
    onMove: (move) => {
      const current = practiceRef.current;
      if (!current.canApply(move)) return;
      setPracticeSoroban(current.apply(move));
      audio.play('bead');
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
    <main className="screen camera">
      <header className="camera__header">
        <button type="button" className="ghost" onClick={onExit} aria-label="Volver a los mundos">
          ←
        </button>
        <h1>Modo cámara</h1>
      </header>

      <CameraView videoRef={videoRef} overlayRef={overlayRef} visible={showVideo} />

      {state.status === 'idle' && (
        <section aria-label="Cómo funciona">
          <p>
            Mové las cuentas con la mano en el aire, sin tocar la pantalla. La cámara sigue la
            posición de tus dedos.
          </p>
          <ul className="camera__facts">
            <li>
              Todo se procesa en este dispositivo: ningún frame de la cámara sale de él ni se
              guarda.
            </li>
            <li>
              La primera vez se descargan unos 20 MB (el modelo de la mano). Después funciona sin
              conexión.
            </li>
            <li>La cámara se enciende recién cuando tocás «Activar cámara» y se apaga al salir.</li>
          </ul>
          <button type="button" className="primary" onClick={() => void camera.activate()}>
            Activar cámara
          </button>
        </section>
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
        <section aria-label="Cámara activa" className="camera__ready">
          <p role="status" className={`camera__status${handSeen ? ' camera__status--ok' : ''}`}>
            {handSeen ? '✓ Veo tu mano' : 'Acercá una mano a la cámara'}
          </p>
          <QualityIndicator quality={camera.quality} onTouch={onExit} />
          <p>
            {mode === 'push'
              ? 'Probá mover las cuentas en el aire: empujalas con el pulgar o el índice, con un movimiento corto y decidido.'
              : 'Probá mover las cuentas en el aire: apuntá con el índice, juntá el pulgar para agarrar la cuenta y arrastrala.'}
          </p>
          <div className="camera__practice">
            <SorobanSvg soroban={practice} readOnly showValue />
          </div>
          <p className="muted">
            Usando la {state.delegate}
            {compat ? ' (modo compatibilidad)' : ''}.
          </p>
          <div className="camera__actions">
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setPracticeSoroban(practiceRef.current.clear());
              }}
            >
              Poner en cero
            </button>
            <button type="button" className="ghost" onClick={camera.recalibrate}>
              Recalibrar
            </button>
            {turnOffButton}
          </div>
        </section>
      )}

      {state.status === 'error' && (
        <CameraErrorPanel
          error={state.error}
          onTouch={onExit}
          onRetry={() => void camera.activate()}
        />
      )}

      <InputModeSelector
        legend="Gesto"
        modes={['push', 'pinch']}
        value={mode}
        onChange={(next) => {
          setSettings({ inputMode: next });
        }}
      />

      <label className="camera__compat">
        <input
          type="checkbox"
          checked={compat}
          disabled={state.status === 'starting'}
          onChange={(e) => {
            vision.setCompatibilityMode(e.target.checked);
            setCompat(e.target.checked);
          }}
        />
        <span>
          Modo compatibilidad (usar la CPU)
          <small className="muted">
            Probalo si la mano no se detecta bien o va lenta. Se aplica la próxima vez que actives
            la cámara.
          </small>
        </span>
      </label>
    </main>
  );
}

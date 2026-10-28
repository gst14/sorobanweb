import { useEffect, useRef, useState } from 'react';
import type {
  CameraOrientation,
  Delegate,
  VisionError,
  VisionPhase,
  VisionSession,
} from '@/application/ports';
import {
  type CaptureIssue,
  type CaptureStep,
  CalibrationCapture,
  orientationOf,
  withRods,
} from '@/application/vision';
import { Soroban } from '@/domain';
import { SorobanSvg } from '../components/soroban/SorobanSvg';
import { HandOverlay, type HandOverlayHandle } from '../components/vision/HandOverlay';
import { useServices } from '../services';
import './CameraScreen.css';

type CameraState =
  | { readonly status: 'idle' }
  | { readonly status: 'starting'; readonly phase: VisionPhase }
  | { readonly status: 'ready'; readonly delegate: Delegate }
  | { readonly status: 'error'; readonly error: Exclude<VisionError, 'aborted'> };

const PHASE_TEXT: Readonly<Record<VisionPhase, string>> = {
  camera: 'Esperando el permiso de la cámara…',
  benchmark:
    'Mostrá una mano frente a la cámara: estoy midiendo qué modo anda mejor en este dispositivo. Tarda unos segundos y se hace una sola vez.',
  loading: 'Cargando el reconocimiento de la mano…',
};

interface ErrorText {
  readonly title: string;
  readonly text: string;
  /** Si tiene sentido volver a intentar sin cambiar de navegador o de dirección. */
  readonly retry: boolean;
}

const ERROR_TEXT: Readonly<Record<Exclude<VisionError, 'aborted'>, ErrorText>> = {
  insecure: {
    title: 'Hace falta una conexión segura',
    text: 'El navegador solo permite usar la cámara en páginas https://. Abrí la app desde su dirección segura o desde la app instalada.',
    retry: false,
  },
  unsupported: {
    title: 'Este navegador no permite usar la cámara',
    text: 'Probá con una versión reciente de Chrome, Safari, Edge o Firefox.',
    retry: false,
  },
  'not-allowed': {
    title: 'No hay permiso para usar la cámara',
    text: 'Habilitá la cámara para este sitio en los ajustes del navegador y volvé a intentar.',
    retry: true,
  },
  'not-found': {
    title: 'No se encontró ninguna cámara',
    text: 'Conectá una cámara o usá un dispositivo que tenga cámara frontal.',
    retry: true,
  },
  'not-readable': {
    title: 'La cámara está ocupada',
    text: 'Otra app la está usando o no responde. Cerrala y volvé a intentar.',
    retry: true,
  },
  unknown: {
    title: 'No se pudo abrir la cámara',
    text: 'Volvé a intentar en unos segundos.',
    retry: true,
  },
  tracker: {
    title: 'No se pudo cargar el reconocimiento de la mano',
    text: 'La primera vez hace falta conexión para descargarlo. Si ya lo usaste, probá con el modo compatibilidad.',
    retry: true,
  },
};

const CAPTURE_TEXT: Readonly<Record<CaptureStep, string>> = {
  left: 'Calibración, paso 1 de 2: poné la punta del índice donde querés el extremo izquierdo de la viga y dejala quieta un segundo.',
  right:
    'Paso 2 de 2: ahora el extremo derecho de la viga, a la misma altura, y otro segundo quieto.',
};

const ISSUE_TEXT: Readonly<Record<CaptureIssue, string>> = {
  'too-narrow':
    'Ese punto quedó muy cerca del primero: alejalo más para que entren todas las varillas.',
  'off-frame':
    'Con la viga a esa altura el soroban no entra en la imagen. Probá con la viga más cerca de la mitad, desde el primer punto.',
};

/** Lo que muestra la pantalla mientras se calibra; el progreso se dibuja en el overlay. */
interface CalibrationView {
  readonly step: CaptureStep;
  readonly issue: CaptureIssue | null;
  /** Si se puede volver a la calibración guardada (al recalibrar, no cuando falta una). */
  readonly canCancel: boolean;
}

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HandOverlayHandle>(null);
  const sessionRef = useRef<VisionSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handSeenRef = useRef(false);
  const captureRef = useRef<CalibrationCapture | null>(null);
  const orientationRef = useRef<CameraOrientation | null>(null);
  const practiceRef = useRef(EMPTY_PRACTICE);
  const [state, setState] = useState<CameraState>({ status: 'idle' });
  const [handSeen, setHandSeen] = useState(false);
  const [calibrating, setCalibrating] = useState<CalibrationView | null>(null);
  const [practice, setPractice] = useState(EMPTY_PRACTICE);
  const [compat, setCompat] = useState(() => vision.compatibilityMode());

  const release = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current?.stop();
    sessionRef.current = null;
    captureRef.current = null;
    orientationRef.current = null;
    overlayRef.current?.clear();
  };

  // Al salir de la pantalla, la cámara se apaga aunque todavía esté arrancando.
  useEffect(() => release, []);

  const beginCapture = (canCancel: boolean) => {
    captureRef.current = new CalibrationCapture();
    setCalibrating({ step: 'left', issue: null, canCancel });
  };

  const endCapture = () => {
    captureRef.current = null;
    setCalibrating(null);
  };

  /** Usa la calibración guardada para esa orientación o, si no hay, pide calibrar. */
  const applyOrientation = (session: VisionSession, orientation: CameraOrientation) => {
    orientationRef.current = orientation;
    const saved = vision.savedCalibration(orientation);
    if (!saved) {
      beginCapture(false);
      return;
    }
    session.setCalibration(withRods(saved, ROD_COUNT));
    endCapture();
  };

  /** Al terminar la calibración, la guarda y la usa; si no, refleja el paso y el aviso. */
  const followCapture = (
    session: VisionSession,
    capture: CalibrationCapture,
    orientation: CameraOrientation,
  ) => {
    const box = capture.result;
    if (box) {
      vision.saveCalibration(orientation, box);
      session.setCalibration(withRods(box, ROD_COUNT));
      endCapture();
      return;
    }
    const { step, issue } = capture;
    // Devolver el mismo objeto evita re-renderizar en cada frame.
    setCalibrating((view) =>
      view && (view.step !== step || view.issue !== issue) ? { ...view, step, issue } : view,
    );
  };

  const setPracticeSoroban = (soroban: Soroban) => {
    practiceRef.current = soroban;
    setPractice(soroban);
  };

  const activate = async () => {
    const video = videoRef.current;
    if (!video) return;
    release();
    const controller = new AbortController();
    abortRef.current = controller;
    handSeenRef.current = false;
    setHandSeen(false);
    setState({ status: 'starting', phase: 'camera' });

    const result = await vision.start(video, {
      mode: 'push',
      getSoroban: () => practiceRef.current,
      signal: controller.signal,
      onPhase: (phase) => {
        setState({ status: 'starting', phase });
      },
      // El overlay se dibuja en cada frame sin pasar por React; la pantalla solo se
      // re-renderiza cuando la mano aparece o desaparece, o cambia el paso de la calibración.
      onFrame: (hand, t) => {
        const session = sessionRef.current;
        if (session) {
          // Al rotar el teléfono cambia la forma de la imagen, y con ella la calibración.
          const orientation = orientationOf(video.videoWidth, video.videoHeight);
          if (orientation !== orientationRef.current) applyOrientation(session, orientation);
          const capture = captureRef.current;
          if (capture) {
            capture.update(hand, t);
            followCapture(session, capture, orientation);
          }
          overlayRef.current?.draw({
            hand,
            calibration: session.calibration,
            mode: session.mode,
            media: { width: video.videoWidth, height: video.videoHeight },
            ...(captureRef.current ? { capture: captureRef.current } : {}),
          });
        }
        const seen = hand !== null;
        if (seen === handSeenRef.current) return;
        handSeenRef.current = seen;
        setHandSeen(seen);
      },
      onError: () => {
        sessionRef.current = null;
        endCapture();
        overlayRef.current?.clear();
        setState({ status: 'error', error: 'tracker' });
      },
    });

    if (controller.signal.aborted) {
      if (result.ok) result.session.stop();
      return;
    }
    abortRef.current = null;
    if (!result.ok) {
      if (result.error !== 'aborted') setState({ status: 'error', error: result.error });
      return;
    }
    const session = result.session;
    sessionRef.current = session;
    applyOrientation(session, orientationOf(video.videoWidth, video.videoHeight));
    // Mientras se calibra, los gestos no mueven cuentas.
    session.start((move) => {
      const current = practiceRef.current;
      if (captureRef.current || !current.canApply(move)) return;
      setPracticeSoroban(current.apply(move));
      audio.play('bead');
    });
    setState({ status: 'ready', delegate: session.delegate });
  };

  const turnOff = () => {
    release();
    setCalibrating(null);
    setState({ status: 'idle' });
  };

  const showVideo = state.status === 'starting' || state.status === 'ready';

  return (
    <main className="screen camera">
      <header className="camera__header">
        <button type="button" className="ghost" onClick={onExit} aria-label="Volver a los mundos">
          ←
        </button>
        <h1>Modo cámara</h1>
      </header>

      <div className="camera__view" hidden={!showVideo}>
        <video ref={videoRef} className="camera__video" playsInline muted />
        <HandOverlay ref={overlayRef} />
      </div>

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
          <button type="button" className="primary" onClick={() => void activate()}>
            Activar cámara
          </button>
        </section>
      )}

      {state.status === 'starting' && (
        <p role="status" className="camera__status">
          {PHASE_TEXT[state.phase]}
        </p>
      )}

      {state.status === 'ready' && calibrating && (
        <section aria-label="Calibración">
          <p role="status" className="camera__status">
            {CAPTURE_TEXT[calibrating.step]}
          </p>
          {calibrating.issue && <p className="camera__issue">{ISSUE_TEXT[calibrating.issue]}</p>}
          {!handSeen && <p className="muted">Acercá una mano a la cámara.</p>}
          <div className="camera__actions">
            {calibrating.canCancel && (
              <button type="button" className="ghost" onClick={endCapture}>
                Cancelar
              </button>
            )}
            <button type="button" className="ghost" onClick={turnOff}>
              Apagar cámara
            </button>
          </div>
        </section>
      )}

      {state.status === 'ready' && !calibrating && (
        <section aria-label="Cámara activa">
          <p role="status" className={`camera__status${handSeen ? ' camera__status--ok' : ''}`}>
            {handSeen ? '✓ Veo tu mano' : 'Acercá una mano a la cámara'}
          </p>
          <p>
            Probá mover las cuentas en el aire: empujalas con el pulgar o el índice, con un
            movimiento corto y decidido.
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
            <button
              type="button"
              className="ghost"
              onClick={() => {
                beginCapture(true);
              }}
            >
              Recalibrar
            </button>
            <button type="button" className="ghost" onClick={turnOff}>
              Apagar cámara
            </button>
          </div>
        </section>
      )}

      {state.status === 'error' && (
        <section role="alert" className="camera__error">
          <h2>{ERROR_TEXT[state.error].title}</h2>
          <p>{ERROR_TEXT[state.error].text}</p>
          <div className="camera__actions">
            <button type="button" className="primary" onClick={onExit}>
              Volver a táctil
            </button>
            {ERROR_TEXT[state.error].retry && (
              <button type="button" className="ghost" onClick={() => void activate()}>
                Reintentar
              </button>
            )}
          </div>
        </section>
      )}

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

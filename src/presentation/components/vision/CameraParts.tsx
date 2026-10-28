import type { ReactNode, RefObject } from 'react';
import type { VisionError, VisionPhase } from '@/application/ports';
import type { CaptureIssue, CaptureStep, QualityLevel } from '@/application/vision';
import type { CalibrationView, QualityView } from '../../hooks/useVisionCamera';
import { HandOverlay, type HandOverlayHandle } from './HandOverlay';
import './CameraParts.css';

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

const QUALITY_TEXT: Readonly<Record<QualityLevel, string>> = {
  good: 'buena',
  fair: 'regular',
  poor: 'mala',
};

/** El video espejado con el overlay de la mano encima; oculto mientras la cámara está apagada. */
export interface CameraViewProps {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly overlayRef: RefObject<HandOverlayHandle | null>;
  readonly visible: boolean;
}

export function CameraView({ videoRef, overlayRef, visible }: CameraViewProps) {
  return (
    <div className="camera__view" hidden={!visible}>
      <video ref={videoRef} className="camera__video" playsInline muted />
      <HandOverlay ref={overlayRef} />
    </div>
  );
}

export function CameraStarting({ phase }: { phase: VisionPhase }) {
  return (
    <p role="status" className="camera__status">
      {PHASE_TEXT[phase]}
    </p>
  );
}

export interface CalibrationPromptProps {
  readonly view: CalibrationView;
  readonly handSeen: boolean;
  readonly onCancel: () => void;
  /** Más acciones, al lado de "Cancelar". */
  readonly children?: ReactNode;
}

export function CalibrationPrompt({ view, handSeen, onCancel, children }: CalibrationPromptProps) {
  return (
    <section aria-label="Calibración">
      <p role="status" className="camera__status">
        {CAPTURE_TEXT[view.step]}
      </p>
      {view.issue && <p className="camera__issue">{ISSUE_TEXT[view.issue]}</p>}
      {!handSeen && <p className="muted">Acercá una mano a la cámara.</p>}
      <div className="camera__actions">
        {view.canCancel && (
          <button type="button" className="ghost" onClick={onCancel}>
            Cancelar
          </button>
        )}
        {children}
      </div>
    </section>
  );
}

export interface CameraErrorPanelProps {
  readonly error: Exclude<VisionError, 'aborted'>;
  readonly onTouch: () => void;
  readonly onRetry: () => void;
}

export function CameraErrorPanel({ error, onTouch, onRetry }: CameraErrorPanelProps) {
  const { title, text, retry } = ERROR_TEXT[error];
  return (
    <section role="alert" className="camera__error">
      <h2>{title}</h2>
      <p>{text}</p>
      <div className="camera__actions">
        <button type="button" className="primary" onClick={onTouch}>
          Volver a táctil
        </button>
        {retry && (
          <button type="button" className="ghost" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </div>
    </section>
  );
}

/**
 * Indicador de calidad (verde, ámbar o rojo) y, si lleva un rato en rojo, la sugerencia de
 * pasar a táctil.
 */
export function QualityIndicator({
  quality,
  onTouch,
}: {
  quality: QualityView;
  onTouch: () => void;
}) {
  return (
    <>
      {quality.level && (
        <p className={`quality quality--${quality.level}`}>
          <span className="quality__dot" aria-hidden="true" />
          Seguimiento: {QUALITY_TEXT[quality.level]}
        </p>
      )}
      {quality.suggestTouch && (
        <div role="alert" className="quality__suggestion">
          <p>La cámara va lenta o no reconoce bien la mano en este dispositivo.</p>
          <button type="button" className="primary" onClick={onTouch}>
            Pasar a táctil
          </button>
        </div>
      )}
    </>
  );
}

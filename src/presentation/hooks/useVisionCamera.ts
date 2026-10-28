import { type RefObject, useEffect, useRef, useState } from 'react';
import type {
  CameraOrientation,
  Delegate,
  GestureMode,
  TraceListener,
  VisionError,
  VisionPhase,
  VisionSession,
} from '@/application/ports';
import {
  type CaptureIssue,
  type CaptureStep,
  type QualityLevel,
  CalibrationCapture,
  QualityMeter,
  orientationOf,
  withRods,
} from '@/application/vision';
import type { Move, Soroban } from '@/domain';
import type { HandOverlayHandle } from '../components/vision/HandOverlay';
import { useServices } from '../services';

export type CameraState =
  | { readonly status: 'idle' }
  | { readonly status: 'starting'; readonly phase: VisionPhase }
  | { readonly status: 'ready'; readonly delegate: Delegate }
  | { readonly status: 'error'; readonly error: Exclude<VisionError, 'aborted'> };

/** Lo que muestra la pantalla mientras se calibra; el progreso se dibuja en el overlay. */
export interface CalibrationView {
  readonly step: CaptureStep;
  readonly issue: CaptureIssue | null;
  /** Si se puede volver a la calibración guardada (al recalibrar, no cuando falta una). */
  readonly canCancel: boolean;
}

/** El indicador de calidad, que solo cambia cuando cambia el nivel o la sugerencia. */
export interface QualityView {
  readonly level: QualityLevel | null;
  readonly suggestTouch: boolean;
}

const NO_QUALITY: QualityView = { level: null, suggestTouch: false };

export interface VisionCameraOptions {
  readonly mode: GestureMode;
  readonly rodCount: number;
  /** El soroban que mueven los gestos, siempre el más reciente. */
  readonly getSoroban: () => Soroban;
  /** Cada movimiento reconocido; mientras se calibra no se emite ninguno. */
  readonly onMove: (move: Move) => void;
}

export interface VisionCamera {
  readonly videoRef: RefObject<HTMLVideoElement | null>;
  readonly overlayRef: RefObject<HandOverlayHandle | null>;
  readonly state: CameraState;
  readonly handSeen: boolean;
  readonly calibrating: CalibrationView | null;
  readonly quality: QualityView;
  /** Pide la cámara: llamarlo solo desde un gesto explícito del usuario. */
  readonly activate: () => Promise<void>;
  readonly turnOff: () => void;
  readonly recalibrate: () => void;
  readonly cancelCalibration: () => void;
  /** Escucha cada frame de la sesión abierta (null deja de escuchar). Para el grabador. */
  readonly setTraceListener: (listener: TraceListener | null) => void;
}

/**
 * La cámara con los gestos, fuera del render: arranca la sesión de visión, pide calibrar si no
 * hay calibración para la orientación de la imagen, dibuja el overlay en cada frame, mide la
 * calidad y entrega los movimientos. Al desmontar, la cámara se apaga aunque esté arrancando.
 */
export function useVisionCamera({
  mode,
  rodCount,
  getSoroban,
  onMove,
}: VisionCameraOptions): VisionCamera {
  const { vision } = useServices();
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HandOverlayHandle>(null);
  const sessionRef = useRef<VisionSession | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const handSeenRef = useRef(false);
  const captureRef = useRef<CalibrationCapture | null>(null);
  const orientationRef = useRef<CameraOrientation | null>(null);
  const meterRef = useRef(new QualityMeter());
  const qualityRef = useRef(NO_QUALITY);
  const latest = useRef({ mode, rodCount, getSoroban, onMove });
  const [state, setState] = useState<CameraState>({ status: 'idle' });
  const [handSeen, setHandSeen] = useState(false);
  const [calibrating, setCalibrating] = useState<CalibrationView | null>(null);
  const [quality, setQuality] = useState(NO_QUALITY);

  useEffect(() => {
    latest.current = { mode, rodCount, getSoroban, onMove };
  });

  useEffect(() => {
    sessionRef.current?.setMode(mode);
  }, [mode]);

  useEffect(() => {
    const session = sessionRef.current;
    if (session && session.calibration.rodCount !== rodCount) {
      session.setCalibration({ ...session.calibration, rodCount });
    }
  }, [rodCount]);

  const showQuality = (view: QualityView) => {
    if (
      view.level === qualityRef.current.level &&
      view.suggestTouch === qualityRef.current.suggestTouch
    ) {
      return;
    }
    qualityRef.current = view;
    setQuality(view);
  };

  const release = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    sessionRef.current?.stop();
    sessionRef.current = null;
    captureRef.current = null;
    orientationRef.current = null;
    meterRef.current.reset();
    showQuality(NO_QUALITY);
    overlayRef.current?.clear();
  };

  // Solo al desmontar; `release` lee todo de refs, así que la primera versión alcanza.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    session.setCalibration(withRods(saved, latest.current.rodCount));
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
      session.setCalibration(withRods(box, latest.current.rodCount));
      endCapture();
      return;
    }
    const { step, issue } = capture;
    // Devolver el mismo objeto evita re-renderizar en cada frame.
    setCalibrating((view) =>
      view && (view.step !== step || view.issue !== issue) ? { ...view, step, issue } : view,
    );
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
      mode: latest.current.mode,
      getSoroban: () => latest.current.getSoroban(),
      signal: controller.signal,
      onPhase: (phase) => {
        setState({ status: 'starting', phase });
      },
      // El overlay se dibuja en cada frame sin pasar por React; solo se re-renderiza cuando la
      // mano aparece o desaparece, cambia el paso de la calibración o el nivel de calidad.
      onFrame: (hand, t) => {
        const session = sessionRef.current;
        if (!session) return;
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
        const { level, suggestTouch } = meterRef.current.update(hand, t);
        showQuality({ level, suggestTouch });
        const seen = hand !== null;
        if (seen === handSeenRef.current) return;
        handSeenRef.current = seen;
        setHandSeen(seen);
      },
      onError: () => {
        release();
        endCapture();
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
    session.start((move) => {
      if (!captureRef.current) latest.current.onMove(move);
    });
    setState({ status: 'ready', delegate: session.delegate });
  };

  return {
    videoRef,
    overlayRef,
    state,
    handSeen,
    calibrating,
    quality,
    activate,
    turnOff: () => {
      release();
      setCalibrating(null);
      setState({ status: 'idle' });
    },
    recalibrate: () => {
      beginCapture(true);
    },
    cancelCalibration: endCapture,
    setTraceListener: (listener) => {
      sessionRef.current?.setTraceListener(listener);
    },
  };
}

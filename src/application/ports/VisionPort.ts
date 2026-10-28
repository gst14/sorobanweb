import type { Soroban } from '@/domain';
import type { CameraError } from './CameraPort';
import type { InputSource } from './InputSource';

/**
 * Landmark normalizado, compatible con `NormalizedLandmark` de MediaPipe sin depender de él.
 * x e y en [0, 1] sobre el frame, ya en espacio pantalla (x espejada para la cámara frontal).
 */
export interface Landmark {
  readonly x: number;
  readonly y: number;
  readonly z?: number;
}

/** Una mano detectada en un frame: los 21 landmarks y el instante del frame en ms. */
export interface HandFrame {
  readonly t: number;
  readonly landmarks: readonly Landmark[];
}

/** Una mano detectada, con la confianza del tracker (0..1). */
export interface TrackedHand extends HandFrame {
  readonly score: number;
}

/** Empuje (pulgar e índice mueven cuentas) o puntero + pinch (el índice agarra y arrastra). */
export type GestureMode = 'push' | 'pinch';

/**
 * Dónde está el soroban "en el aire", en coordenadas normalizadas de pantalla.
 * Lo produce la calibración (índice en la viga y en las varillas extremas).
 */
export interface Calibration {
  /** x del borde izquierdo del ROI (varilla `rodCount − 1`). */
  readonly left: number;
  /** x del borde derecho del ROI (varilla 0). */
  readonly right: number;
  /** y de la viga. */
  readonly beamY: number;
  /** Alto de una cuenta, en unidades de y. */
  readonly beadHeight: number;
  readonly rodCount: number;
}

/** Backend de inferencia del tracker. Se elige uno por dispositivo. */
export type Delegate = 'GPU' | 'CPU';

/**
 * Por qué no arrancó el modo cámara: un error de la cámara, el tracker que no cargó (sin red
 * la primera vez, o ningún delegado disponible) o `aborted` si quien llamó canceló.
 */
export type VisionError = CameraError | 'tracker' | 'aborted';

/** Etapas del arranque, para mostrar qué está pasando. */
export type VisionPhase = 'camera' | 'benchmark' | 'loading';

export interface VisionStartOptions {
  readonly mode: GestureMode;
  /** Sin calibración se usa un recuadro centrado (provisorio hasta la calibración, 2.16). */
  readonly calibration?: Calibration;
  readonly getSoroban: () => Soroban;
  readonly onPhase?: (phase: VisionPhase) => void;
  /** Cada frame procesado, con o sin mano: para el overlay y el indicador de calidad. */
  readonly onFrame?: (hand: TrackedHand | null, t: number) => void;
  /** El tracker falló en pleno uso. La sesión ya se detuvo y liberó la cámara. */
  readonly onError?: (error: unknown) => void;
  readonly signal?: AbortSignal;
}

/** Entrada por cámara ya abierta. `stop()` apaga la cámara y libera el tracker. */
export interface VisionSession extends InputSource {
  readonly kind: 'vision';
  readonly delegate: Delegate;
  readonly mode: GestureMode;
  setMode(mode: GestureMode): void;
  setCalibration(calibration: Calibration): void;
}

export type VisionResult =
  | { readonly ok: true; readonly session: VisionSession }
  | { readonly ok: false; readonly error: VisionError };

export interface VisionPort {
  /**
   * Abre la cámara en `video`, elige el delegado (el guardado o, si no hay, lo mide con la mano
   * a la vista) y carga el tracker. Llamarlo solo después de un gesto explícito del usuario.
   * El `<video>` tiene que ser real: el tracker lee sus frames.
   */
  start(video: HTMLVideoElement, options: VisionStartOptions): Promise<VisionResult>;
  /** "Modo compatibilidad": usar siempre la CPU en este dispositivo. */
  compatibilityMode(): boolean;
  /** Se aplica la próxima vez que arranque la cámara. Desactivarlo vuelve a medir. */
  setCompatibilityMode(on: boolean): void;
}

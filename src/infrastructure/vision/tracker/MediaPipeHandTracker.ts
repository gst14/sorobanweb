import type { HandLandmarker, HandLandmarkerOptions } from '@mediapipe/tasks-vision';
import type { Delegate, TrackedHand } from '@/application/ports';
import type { Landmark } from '@/application/vision';

/** Rutas del loader y del binario WASM; el paquete no exporta el tipo. */
export type WasmFileset = Parameters<typeof HandLandmarker.createFromOptions>[0];

// `score` de TrackedHand es el de handedness de MediaPipe. El benchmark (2.13) elige el delegado.
export type { Delegate, TrackedHand };

/** Lo que el tracker lee de cada resultado; `HandLandmarkerResult` lo cumple. */
export interface HandResultLike {
  readonly landmarks: readonly (readonly Landmark[])[];
  readonly handedness: readonly (readonly { readonly score: number }[])[];
}

export interface HandLandmarkerLike {
  detectForVideo(video: HTMLVideoElement, timestamp: number): HandResultLike;
  close(): void;
}

/** Subconjunto de `@mediapipe/tasks-vision` que se usa; el import dinámico real lo cumple. */
export interface VisionModule {
  readonly FilesetResolver: { forVisionTasks(basePath: string): Promise<WasmFileset> };
  readonly HandLandmarker: {
    createFromOptions(
      fileset: WasmFileset,
      options: HandLandmarkerOptions,
    ): Promise<HandLandmarkerLike>;
  };
}

export interface HandTracker {
  readonly delegate: Delegate;
  /** Detecta la mano en el frame actual del video; `t` es el `performance.now()` del frame. */
  detect(video: HTMLVideoElement, t: number): TrackedHand | null;
  /** Libera el grafo de MediaPipe (y su contexto WebGL con el delegado GPU). */
  close(): void;
}

export interface LoadHandTrackerOptions {
  readonly delegate: Delegate;
  /** Raíz donde se sirven `mediapipe/wasm/` y `models/` (por defecto, `import.meta.env.BASE_URL`). */
  readonly baseUrl?: string;
  /** Importador de MediaPipe; los tests pasan un fake. */
  readonly importVision?: () => Promise<VisionModule>;
}

export const WASM_DIR = 'mediapipe/wasm';
export const MODEL_PATH = 'models/hand_landmarker.task';

/**
 * Chunk aparte: el modo táctil nunca lo descarga, ni tampoco el WASM ni el modelo, que se
 * piden recién en `loadHandTracker`.
 */
const importMediaPipe = (): Promise<VisionModule> => import('@mediapipe/tasks-vision');

/**
 * Pasa el resultado de MediaPipe a espacio pantalla: la cámara frontal se muestra espejada,
 * así que x → 1 − x. Devuelve null si no hay mano.
 */
export function toTrackedHand(result: HandResultLike, t: number): TrackedHand | null {
  const hand = result.landmarks[0];
  if (!hand || hand.length === 0) return null;
  const landmarks = hand.map((lm): Landmark => {
    const mirrored = { x: 1 - lm.x, y: lm.y };
    return lm.z === undefined ? mirrored : { ...mirrored, z: lm.z };
  });
  return { t, landmarks, score: result.handedness[0]?.[0]?.score ?? 0 };
}

/** Adaptador del HandLandmarker en modo VIDEO, con una sola mano. */
export class MediaPipeHandTracker implements HandTracker {
  readonly delegate: Delegate;
  private readonly landmarker: HandLandmarkerLike;
  private lastTimestamp = -Infinity;

  constructor(landmarker: HandLandmarkerLike, delegate: Delegate) {
    this.landmarker = landmarker;
    this.delegate = delegate;
  }

  detect(video: HTMLVideoElement, t: number): TrackedHand | null {
    // En modo VIDEO, MediaPipe lanza si el timestamp no crece estrictamente.
    const timestamp = Math.max(t, this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;
    return toTrackedHand(this.landmarker.detectForVideo(video, timestamp), t);
  }

  close(): void {
    this.landmarker.close();
  }
}

/**
 * Carga MediaPipe, su WASM y el modelo, todo del mismo origen. Rechaza si el delegado no está
 * disponible (por ejemplo, GPU sin WebGL2); quien llama decide si reintenta con CPU.
 */
export async function loadHandTracker({
  delegate,
  baseUrl = import.meta.env.BASE_URL,
  importVision = importMediaPipe,
}: LoadHandTrackerOptions): Promise<HandTracker> {
  const vision = await importVision();
  const fileset = await vision.FilesetResolver.forVisionTasks(`${baseUrl}${WASM_DIR}`);
  const landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: `${baseUrl}${MODEL_PATH}`, delegate },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  return new MediaPipeHandTracker(landmarker, delegate);
}

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

/** Dedos que empujan cuentas: pulgar (punta 4) e índice (punta 8). */
export type PusherFinger = 'thumb' | 'index';

export const LANDMARK_COUNT = 21;
export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
export const MIDDLE_MCP = 9;

const TIPS: Readonly<Record<PusherFinger, number>> = { thumb: THUMB_TIP, index: INDEX_TIP };

export const distance = (a: Landmark, b: Landmark): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Punta del dedo, o null si el frame no trae ese landmark. */
export const fingertip = (frame: HandFrame, finger: PusherFinger): Landmark | null =>
  frame.landmarks[TIPS[finger]] ?? null;

/** Tamaño de la mano: distancia de la muñeca al MCP del medio. Null si falta o es 0. */
export function handScale(frame: HandFrame): number | null {
  const wrist = frame.landmarks[WRIST];
  const mcp = frame.landmarks[MIDDLE_MCP];
  if (!wrist || !mcp) return null;
  const size = distance(wrist, mcp);
  return size > 0 ? size : null;
}

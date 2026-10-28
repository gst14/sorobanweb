import {
  type HandFrame,
  type Landmark,
  INDEX_TIP,
  LANDMARK_COUNT,
  MIDDLE_MCP,
  THUMB_TIP,
  WRIST,
} from '../landmarks';

export interface HandSpec {
  readonly t?: number;
  readonly thumb?: Landmark;
  readonly index?: Landmark;
  /** Tamaño de la mano (muñeca → MCP del medio). */
  readonly scale?: number;
}

/**
 * Mano sintética de 21 landmarks: la muñeca en (0,5; 0,9) y el MCP del medio `scale` más arriba.
 * El resto de los landmarks queda en el centro; solo importan 0, 4, 8 y 9.
 */
export function hand({
  t = 0,
  thumb = { x: 0.4, y: 0.5 },
  index = { x: 0.6, y: 0.5 },
  scale = 0.2,
}: HandSpec = {}): HandFrame {
  const landmarks: Landmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5 }));
  landmarks[WRIST] = { x: 0.5, y: 0.9 };
  landmarks[MIDDLE_MCP] = { x: 0.5, y: 0.9 - scale };
  landmarks[THUMB_TIP] = thumb;
  landmarks[INDEX_TIP] = index;
  return { t, landmarks };
}

/** Mano con el pinch en una razón dada (distancia 4↔8 / tamaño de la mano). */
export const pinchAt = (ratio: number, t = 0, scale = 0.2): HandFrame =>
  hand({ t, scale, thumb: { x: 0.5, y: 0.5 }, index: { x: 0.5 + ratio * scale, y: 0.5 } });

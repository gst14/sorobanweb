import type { Calibration } from '../calibration';

/** 7 varillas de 0,1 de ancho entre x = 0,15 y x = 0,85; viga en y = 0,4; cuentas de 0,05. */
export const CAL: Calibration = {
  left: 0.15,
  right: 0.85,
  beamY: 0.4,
  beadHeight: 0.05,
  rodCount: 7,
};

export const FRAME_MS = 1000 / 30;

/** x del centro de una varilla (0 = derecha). */
export const rodX = (cal: Calibration, rod: number): number =>
  cal.left + (cal.rodCount - 1 - rod + 0.5) * ((cal.right - cal.left) / cal.rodCount);

/** y para una posición en alturas de cuenta desde la viga (negativa = cielo). */
export const unitsY = (cal: Calibration, u: number): number => cal.beamY + u * cal.beadHeight;

export interface TipSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/**
 * Trazo vertical sintético sobre una varilla: `holdMs` quieto en `from`, después un movimiento
 * lineal hasta `to` en `durationMs`, y `holdMs` quieto al final. Frames cada `frameMs`.
 */
export function stroke(
  cal: Calibration,
  {
    rod,
    from,
    to,
    t0 = 0,
    durationMs = 100,
    holdMs = 300,
    frameMs = FRAME_MS,
  }: {
    rod: number;
    from: number;
    to: number;
    t0?: number;
    durationMs?: number;
    holdMs?: number;
    frameMs?: number;
  },
): TipSample[] {
  const x = rodX(cal, rod);
  const total = holdMs + durationMs + holdMs;
  const samples: TipSample[] = [];
  for (let dt = 0; dt <= total; dt += frameMs) {
    const k = Math.min(1, Math.max(0, (dt - holdMs) / durationMs));
    samples.push({ x, y: unitsY(cal, from + (to - from) * k), t: t0 + dt });
  }
  return samples;
}

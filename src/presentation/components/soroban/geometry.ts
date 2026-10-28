import type { EarthSlot } from '@/domain';

/** Rectángulo en unidades del viewBox. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SorobanLayout {
  readonly width: number;
  readonly height: number;
  readonly rodCount: number;
  /** Separación horizontal entre varillas y vertical entre posiciones de cuenta. */
  readonly pitchX: number;
  readonly pitchY: number;
  readonly beam: Box;
  readonly beadWidth: number;
  readonly beadHeight: number;
  /** Centro x de la varilla i (0 = la de la derecha). */
  rodX(rod: number): number;
  /** Celda de la cuenta del cielo (abajo = tocando la viga). */
  heavenCell(rod: number, down: boolean): Box;
  /** Celda de la cuenta de tierra `slot` (0 = la más cercana a la viga). */
  earthCell(rod: number, slot: EarthSlot, active: boolean): Box;
  /** Varillas que llevan punto de unidad (cada 3 a partir de la de unidades). */
  readonly unitDots: readonly number[];
}

const PAD = 24;
const PITCH_X = 100;
const PITCH_Y = 92;
const BEAM_HEIGHT = 22;
const BEAD_WIDTH = 86;
const BEAD_HEIGHT = 60;

/**
 * Geometría en unidades de viewBox. Cada celda mide PITCH_X × PITCH_Y: es el área táctil de la
 * cuenta, mayor que la cuenta dibujada. Las cuentas activas ocupan las posiciones 0..e−1 junto a la
 * viga, el hueco queda en e y las inactivas en e+1..4, así que las celdas nunca se superponen.
 */
export function computeLayout(rodCount: number, unitRod = 0): SorobanLayout {
  const width = PAD * 2 + rodCount * PITCH_X;
  const heavenTop = PAD;
  const beamY = heavenTop + 2 * PITCH_Y;
  const earthTop = beamY + BEAM_HEIGHT;
  const height = earthTop + 5 * PITCH_Y + PAD;

  const rodX = (rod: number) => width - PAD - (rod + 0.5) * PITCH_X;
  const cell = (rod: number, top: number): Box => ({
    x: rodX(rod) - PITCH_X / 2,
    y: top,
    width: PITCH_X,
    height: PITCH_Y,
  });

  const unitDots: number[] = [];
  for (let rod = unitRod % 3; rod < rodCount; rod += 3) unitDots.push(rod);

  return {
    width,
    height,
    rodCount,
    pitchX: PITCH_X,
    pitchY: PITCH_Y,
    beam: { x: PAD / 2, y: beamY, width: width - PAD, height: BEAM_HEIGHT },
    beadWidth: BEAD_WIDTH,
    beadHeight: BEAD_HEIGHT,
    rodX,
    heavenCell: (rod, down) => cell(rod, heavenTop + (down ? PITCH_Y : 0)),
    earthCell: (rod, slot, active) => cell(rod, earthTop + (slot + (active ? 0 : 1)) * PITCH_Y),
    unitDots,
  };
}

/** Lado menor del área táctil, en px CSS, si el SVG se dibuja con `renderedWidthPx`. */
export const touchTargetPx = (layout: SorobanLayout, renderedWidthPx: number): number =>
  (Math.min(layout.pitchX, layout.pitchY) * renderedWidthPx) / layout.width;

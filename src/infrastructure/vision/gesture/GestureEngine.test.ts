import { describe, expect, it } from 'vitest';
import { type Move, Soroban } from '@/domain';
import { GestureEngine } from './GestureEngine';
import type { HandFrame } from '@/application/vision';
import { hand, pointerHand } from '@/application/vision/testing/hands';
import { CAL, FRAME_MS, rodX, stroke, unitsY } from './testing/strokes';

const RAW = { minCutoff: 1e4 };

/** Corre el motor con frames (o huecos `null` en el instante dado) y aplica los movimientos. */
function run(
  engine: GestureEngine,
  input: readonly (HandFrame | { readonly gapAt: number })[],
  start = Soroban.create(7),
) {
  let soroban = start;
  const moves: Move[] = [];
  for (const item of input) {
    const out =
      'gapAt' in item
        ? engine.update(null, item.gapAt, soroban)
        : engine.update(item, item.t, soroban);
    for (const move of out) {
      moves.push(move);
      soroban = soroban.apply(move);
    }
  }
  return { soroban, moves };
}

describe('GestureEngine · empuje', () => {
  const engine = () =>
    new GestureEngine({ mode: 'push', calibration: CAL, pusher: { filter: RAW } });

  it('el pulgar y el índice empujan a la vez; el índice ve el soroban ya movido', () => {
    // Pulgar: sube 1 de tierra en la varilla 0. Índice: baja el cielo de la misma varilla.
    const thumb = stroke(CAL, { rod: 0, from: 1.5, to: 0.5 });
    const index = stroke(CAL, { rod: 0, from: -1.5, to: -0.5 });
    const input = thumb.map((s, i) => {
      const ix = index[i] ?? s;
      return hand({ t: s.t, thumb: { x: s.x, y: s.y }, index: { x: ix.x, y: ix.y } });
    });
    const { moves, soroban } = run(engine(), input);
    expect(moves.map((m) => m.finger)).toEqual(['thumb', 'index']);
    expect(soroban.toNumber()).toBe(6);
  });

  it('un frame sin puntas no mueve nada', () => {
    expect(engine().update({ t: 0, landmarks: [] }, 0, Soroban.create(7))).toEqual([]);
  });
});

describe('GestureEngine · puntero + pinch', () => {
  const engine = () =>
    new GestureEngine({ mode: 'pinch', calibration: CAL, pointer: { filter: RAW } });
  const x = rodX(CAL, 0);
  const at = (i: number, u: number, pinched: boolean) =>
    pointerHand(i * FRAME_MS, x, unitsY(CAL, u), pinched);
  /** Dwell abierto (frames 0–5) y pinch confirmado en el frame 8, sobre la cuenta en 3,5. */
  const grab = [0, 1, 2, 3, 4, 5]
    .map((i) => at(i, 3.5, false))
    .concat([6, 7, 8].map((i) => at(i, 3.5, true)));

  it('agarrar y arrastrar emite el movimiento', () => {
    const { moves } = run(engine(), [...grab, at(9, 1, true)]);
    expect(moves).toMatchObject([{ deck: 'earth', delta: 3 }]);
    expect(engine().mode).toBe('pinch');
  });

  it('un hueco corto (100 ms) no suelta la cuenta agarrada', () => {
    const gap = [{ gapAt: 9 * FRAME_MS }, { gapAt: 9 * FRAME_MS + 100 }];
    const { moves } = run(engine(), [...grab, ...gap, at(13, 1, true)]);
    expect(moves).toHaveLength(1);
  });

  it('una mano que desaparece 300 ms en medio de un pinch no deja la cuenta agarrada', () => {
    const lost = 8 * FRAME_MS + 300;
    const { moves } = run(engine(), [
      ...grab,
      { gapAt: 9 * FRAME_MS },
      { gapAt: lost },
      at(20, 1, true),
      at(21, 1, true),
    ]);
    expect(moves).toEqual([]);
  });

  it('un hueco antes de ver la mano no hace nada', () => {
    expect(engine().update(null, 1000, Soroban.create(7))).toEqual([]);
  });
});

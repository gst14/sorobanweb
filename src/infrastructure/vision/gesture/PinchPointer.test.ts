import { describe, expect, it } from 'vitest';
import { type Move, Soroban } from '@/domain';
import type { HandFrame } from '@/application/vision';
import { PinchPointer } from './PinchPointer';
import { pointerHand } from '@/application/vision/testing/hands';
import { CAL, FRAME_MS, rodX, unitsY } from './testing/strokes';

const RAW = { filter: { minCutoff: 1e4 } };

interface Step {
  /** Posición vertical en alturas de cuenta. */
  readonly u: number;
  readonly pinched: boolean;
  readonly frames?: number;
  readonly rod?: number;
}

/** Arma frames a 30 fps a partir de tramos (posición, pinch, cantidad de frames). */
function frames(steps: readonly Step[], t0 = 0): HandFrame[] {
  const out: HandFrame[] = [];
  let t = t0;
  for (const { u, pinched, frames: n = 1, rod = 0 } of steps) {
    for (let i = 0; i < n; i++) {
      out.push(pointerHand(t, rodX(CAL, rod), unitsY(CAL, u), pinched));
      t += FRAME_MS;
    }
  }
  return out;
}

function play(pointer: PinchPointer, input: readonly HandFrame[], start = Soroban.create(7)) {
  let soroban = start;
  const moves: Move[] = [];
  for (const frame of input) {
    const move = pointer.update(frame, soroban);
    if (move) {
      moves.push(move);
      soroban = soroban.apply(move);
    }
  }
  return { soroban, moves };
}

/** Quieto y abierto 200 ms (cumple el dwell), después pinch de 3 frames en `u`. */
const grabAt = (u: number): Step[] => [
  { u, pinched: false, frames: 6 },
  { u, pinched: true, frames: 3 },
];

describe('PinchPointer', () => {
  it('agarra la cuenta bajo el cursor y la arrastra una vez por agarre', () => {
    const p = new PinchPointer(CAL, RAW);
    const input = frames([
      ...grabAt(3.5),
      { u: 2.5, pinched: true },
      { u: 1, pinched: true, frames: 5 },
    ]);
    const { moves, soroban } = play(p, input);
    expect(moves).toMatchObject([{ rod: 0, deck: 'earth', delta: 3, finger: 'unknown' }]);
    expect(soroban.toNumber()).toBe(3);
    expect(p.cursor).toEqual({ rod: 0, grabbing: true });
  });

  it('agarra el cielo y lo baja hacia la viga', () => {
    const p = new PinchPointer(CAL, RAW);
    const input = frames([...grabAt(-1.5), { u: -0.5, pinched: true, frames: 2 }]);
    expect(play(p, input).soroban.toNumber()).toBe(5);
  });

  it('alejar de la viga una cuenta activa la baja', () => {
    const p = new PinchPointer(CAL, RAW);
    const input = frames([...grabAt(0.5), { u: 2, pinched: true, frames: 2 }]);
    expect(play(p, input, Soroban.fromNumber(1, 7)).soroban.toNumber()).toBe(0);
  });

  it('sin dwell no agarra', () => {
    const p = new PinchPointer(CAL, RAW);
    const input = frames([
      { u: 3.5, pinched: false, rod: 1, frames: 6 },
      { u: 3.5, pinched: true, rod: 0, frames: 3 },
      { u: 1, pinched: true, rod: 0, frames: 5 },
    ]);
    expect(play(p, input).moves).toEqual([]);
    expect(p.cursor).toEqual({ rod: 0, grabbing: false });
  });

  it('soltar el pinch a mitad del trazo no emite', () => {
    const p = new PinchPointer(CAL, RAW);
    const input = frames([
      ...grabAt(3.5),
      { u: 3.3, pinched: true },
      { u: 3.3, pinched: false, frames: 3 },
      { u: 1, pinched: false, frames: 5 },
    ]);
    expect(play(p, input).moves).toEqual([]);
    expect(p.cursor.grabbing).toBe(false);
  });

  it('arrastrar una cuenta contra la viga agarra pero no emite', () => {
    const p = new PinchPointer(CAL, RAW);
    const input = frames([...grabAt(0.5), { u: -0.5, pinched: true, frames: 3 }]);
    expect(play(p, input, Soroban.fromNumber(1, 7)).moves).toEqual([]);
  });

  it('no agarra fuera de las secciones, fuera del ROI ni más allá del soroban', () => {
    const offTrack = new PinchPointer(CAL, RAW);
    expect(play(offTrack, frames([...grabAt(8), { u: 6, pinched: true }])).moves).toEqual([]);

    const outside = new PinchPointer(CAL, RAW);
    const y = unitsY(CAL, 3.5);
    const far = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => pointerHand(i * FRAME_MS, 0.97, y, i >= 6));
    play(outside, far);
    expect(outside.cursor).toEqual({ rod: null, grabbing: false });

    const short = new PinchPointer(CAL, RAW);
    const rod5 = frames([
      { u: 3.5, pinched: false, rod: 5, frames: 6 },
      { u: 3.5, pinched: true, rod: 5, frames: 3 },
    ]);
    play(short, rod5, Soroban.create(3));
    expect(short.cursor.grabbing).toBe(false);
  });

  it('ignora frames sin índice y se puede reiniciar', () => {
    const p = new PinchPointer(CAL, RAW);
    expect(p.update({ t: 0, landmarks: [] }, Soroban.create(7))).toBeNull();
    play(p, frames(grabAt(3.5)));
    expect(p.cursor.grabbing).toBe(true);
    p.reset();
    expect(p.cursor).toEqual({ rod: null, grabbing: false });
  });
});

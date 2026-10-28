import { describe, expect, it } from 'vitest';
import type { GestureMode } from '@/application/ports';
import { type HandFrame, type SessionRecording, SessionRecorder } from '@/application/vision';
import { hand, pointerHand } from '@/application/vision/testing/hands';
import { Soroban } from '@/domain';
import { GestureEngine } from './GestureEngine';
import { expectedMoves, replayRecording } from './replay';
import { CAL, FRAME_MS, rodX, stroke, unitsY } from './testing/strokes';

/**
 * Graba como lo haría `VisionInput`: el motor por defecto procesa cada frame, el soroban
 * avanza con sus movimientos y cada frame pasa por el grabador. `null` = frame sin mano.
 */
function record(
  frames: readonly (HandFrame | { readonly gapAt: number })[],
  mode: GestureMode = 'push',
  start = Soroban.create(7),
): SessionRecording {
  const recorder = new SessionRecorder();
  const engine = new GestureEngine({ mode, calibration: CAL });
  let soroban = start;
  frames.forEach((item, i) => {
    const t = 'gapAt' in item ? item.gapAt : item.t;
    const frame = 'gapAt' in item ? null : { ...item, score: 0.9 };
    const moves = engine.update(frame, t, soroban);
    recorder.add({
      t,
      hand: frame,
      soroban,
      moves,
      ...(i === 0 ? { engine: { mode, calibration: CAL } } : {}),
    });
    for (const move of moves) soroban = soroban.apply(move);
  });
  // Ida y vuelta por JSON, como un archivo descargado.
  return JSON.parse(JSON.stringify(recorder.toRecording('test', new Date(0)))) as SessionRecording;
}

const thumbStroke = (rod: number, from: number, to: number, t0 = 0) =>
  stroke(CAL, { rod, from, to, t0 }).map((s) =>
    hand({ t: s.t, thumb: { x: s.x, y: s.y }, index: { x: 0.95, y: 0.95 } }),
  );

describe('replayRecording', () => {
  it('reproduce los mismos movimientos que se grabaron en modo empuje', () => {
    // Subir 3 cuentas y después bajar las de más abajo.
    const up = thumbStroke(0, 3.5, 0.5);
    const down = thumbStroke(0, 2.5, 3.5, (up.at(-1)?.t ?? 0) + FRAME_MS);
    const recording = record([...up, ...down]);
    const expected = expectedMoves(recording);
    expect(expected.flatMap((f) => f.moves.map((m) => m.delta))).toEqual([3, -2]);
    expect(replayRecording(recording)).toEqual(expected);
  });

  it('reproduce el modo puntero, con un hueco corto en medio del pinch', () => {
    const x = rodX(CAL, 0);
    const at = (i: number, u: number, pinched: boolean) =>
      pointerHand(i * FRAME_MS, x, unitsY(CAL, u), pinched);
    const frames = [
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => at(i, 3.5, false)),
      ...[9, 10, 11, 12].map((i) => at(i, 3.5, true)),
      { gapAt: 13 * FRAME_MS },
      ...[14, 15, 16, 17, 18, 19, 20].map((i) => at(i, 1, true)),
    ];
    const recording = record(frames, 'pinch');
    expect(expectedMoves(recording).length).toBeGreaterThan(0);
    expect(replayRecording(recording)).toEqual(expectedMoves(recording));
  });

  it('usa el soroban grabado en cada frame, aunque haya cambiado por fuera del motor', () => {
    const recording = record(thumbStroke(0, 1.5, 0.5));
    // Con la tierra llena, subir una cuenta más no es posible: el motor no emite nada.
    const full: SessionRecording = {
      ...recording,
      frames: recording.frames.map((f, i) =>
        i === 0 ? { ...f, soroban: [4, 0, 0, 0, 0, 0, 0] } : f,
      ),
    };
    expect(replayRecording(full)).toEqual([]);
  });

  it('crea el motor de nuevo cuando la grabación cambia de modo', () => {
    const recording = record(thumbStroke(0, 1.5, 0.5));
    const pinch: SessionRecording = {
      ...recording,
      frames: recording.frames.map((f, i) =>
        i === 1 ? { ...f, engine: { mode: 'pinch', calibration: CAL } } : f,
      ),
    };
    // En modo puntero, un trazo del pulgar sin pinch no mueve nada.
    expect(replayRecording(pinch)).toEqual([]);
  });

  it('aplica los ajustes del motor que se le pasan', () => {
    const recording = record(thumbStroke(0, 1.5, 0.5));
    expect(replayRecording(recording, { pusher: { strokeBeads: 5 } })).toEqual([]);
  });

  it('falla si la grabación no trae el motor o el soroban al principio', () => {
    const recording = record(thumbStroke(0, 1.5, 0.5));
    const frames = recording.frames.map((f, i) =>
      i === 0 ? { t: f.t, hand: f.hand, soroban: [0, 0, 0, 0, 0, 0, 0] as const } : f,
    );
    expect(() => replayRecording({ ...recording, frames })).toThrow('le falta el motor');
  });
});

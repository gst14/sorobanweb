import type { RecordedFrame, SessionRecording } from '@/application/vision';
import { type Move, Soroban } from '@/domain';
import { type GestureEngineOptions, GestureEngine } from './GestureEngine';

export type ReplayTuning = Omit<GestureEngineOptions, 'mode' | 'calibration'>;

/** Movimientos de un frame, con el instante para ubicarlo en la grabación. */
export interface FrameMoves {
  readonly t: number;
  readonly moves: readonly Move[];
}

/**
 * Pasa los frames de una grabación por el motor de gestos, con el mismo soroban, modo y
 * calibración que tenía al grabar, y devuelve los movimientos de cada frame que emitió alguno.
 */
export function replayRecording(recording: SessionRecording, tuning?: ReplayTuning): FrameMoves[] {
  let engine: GestureEngine | null = null;
  let soroban: Soroban | null = null;
  const result: FrameMoves[] = [];
  for (const frame of recording.frames) {
    if (frame.engine) engine = new GestureEngine({ ...tuning, ...frame.engine });
    if (frame.soroban) soroban = Soroban.fromDigits(frame.soroban);
    if (!engine || !soroban) throw new Error(`Al frame ${String(frame.t)} le falta el motor`);
    const hand = frame.hand && {
      t: frame.t,
      landmarks: frame.hand.landmarks.map(([x, y]) => ({ x, y })),
    };
    const moves = engine.update(hand, frame.t, soroban);
    if (moves.length > 0) result.push({ t: frame.t, moves });
  }
  return result;
}

/** Los movimientos esperados que guarda la grabación, en el mismo formato que el replay. */
export const expectedMoves = (recording: SessionRecording): FrameMoves[] =>
  recording.frames
    .filter((f): f is RecordedFrame & { moves: readonly Move[] } => (f.moves?.length ?? 0) > 0)
    .map(({ t, moves }) => ({ t, moves }));

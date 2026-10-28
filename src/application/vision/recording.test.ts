import { describe, expect, it } from 'vitest';
import type { Calibration, FrameTrace } from '@/application/ports';
import { type Move, Soroban } from '@/domain';
import { RECORDING_VERSION, SessionRecorder, recordingFileName } from './recording';
import { hand } from './testing/hands';

const CAL: Calibration = { left: 0.15, right: 0.85, beamY: 0.4, beadHeight: 0.05, rodCount: 7 };
const ENGINE = { mode: 'push', calibration: CAL } as const;
const MOVE: Move = { rod: 0, deck: 'earth', delta: 1, finger: 'thumb', at: 33 };

const trace = (overrides: Partial<FrameTrace> = {}): FrameTrace => ({
  t: 0,
  hand: { ...hand(), score: 0.9 },
  soroban: Soroban.create(7),
  moves: [],
  ...overrides,
});

describe('SessionRecorder', () => {
  it('graba la mano como pares [x, y] con su confianza', () => {
    const recorder = new SessionRecorder();
    recorder.add(trace({ engine: ENGINE }));
    const [frame] = recorder.toRecording('', new Date(0)).frames;
    expect(frame?.hand?.score).toBe(0.9);
    expect(frame?.hand?.landmarks).toHaveLength(21);
    expect(frame?.hand?.landmarks[4]).toEqual([0.4, 0.5]);
  });

  it('un frame sin mano queda con hand null', () => {
    const recorder = new SessionRecorder();
    recorder.add(trace({ engine: ENGINE, hand: null }));
    expect(recorder.toRecording('', new Date(0)).frames[0]?.hand).toBeNull();
  });

  it('el primer frame tiene que traer el motor', () => {
    expect(() => {
      new SessionRecorder().add(trace());
    }).toThrow('modo y la calibración');
  });

  it('guarda el soroban solo cuando cambia', () => {
    const recorder = new SessionRecorder();
    recorder.add(trace({ t: 0, engine: ENGINE }));
    recorder.add(trace({ t: 33 }));
    recorder.add(trace({ t: 66, soroban: Soroban.fromNumber(1, 7) }));
    recorder.add(trace({ t: 99, soroban: Soroban.fromNumber(1, 7) }));
    recorder.add(trace({ t: 132, soroban: Soroban.fromNumber(1, 5) }));
    const frames = recorder.toRecording('', new Date(0)).frames;
    expect(frames.map((f) => f.soroban)).toEqual([
      [0, 0, 0, 0, 0, 0, 0],
      undefined,
      [1, 0, 0, 0, 0, 0, 0],
      undefined,
      [1, 0, 0, 0, 0],
    ]);
  });

  it('guarda el motor y los movimientos solo en los frames que los traen', () => {
    const recorder = new SessionRecorder();
    recorder.add(trace({ t: 0, engine: ENGINE }));
    recorder.add(trace({ t: 33, moves: [MOVE] }));
    recorder.add(trace({ t: 66, engine: { mode: 'pinch', calibration: CAL } }));
    const frames = recorder.toRecording('', new Date(0)).frames;
    expect(frames.map((f) => f.engine?.mode)).toEqual(['push', undefined, 'pinch']);
    expect(frames.map((f) => f.moves)).toEqual([undefined, [MOVE], undefined]);
  });

  it('copia la calibración y los movimientos, no guarda referencias', () => {
    const recorder = new SessionRecorder();
    const engine = { mode: 'push', calibration: { ...CAL } } as const;
    recorder.add(trace({ engine, moves: [MOVE] }));
    const [frame] = recorder.toRecording('', new Date(0)).frames;
    expect(frame?.engine?.calibration).not.toBe(engine.calibration);
    expect(frame?.moves?.[0]).not.toBe(MOVE);
  });

  it('cuenta frames y duración, y deja de grabar cuando se llena', () => {
    const recorder = new SessionRecorder(3);
    expect(recorder.durationMs).toBe(0);
    recorder.add(trace({ t: 100, engine: ENGINE }));
    recorder.add(trace({ t: 133 }));
    expect(recorder.full).toBe(false);
    recorder.add(trace({ t: 166 }));
    recorder.add(trace({ t: 199 }));
    expect(recorder.full).toBe(true);
    expect(recorder.frameCount).toBe(3);
    expect(recorder.durationMs).toBe(66);
  });

  it('arma la grabación con versión, fecha y descripción', () => {
    const recorder = new SessionRecorder();
    recorder.add(trace({ engine: ENGINE }));
    const recording = recorder.toRecording('subir 3 y bajar 1', new Date('2026-10-28T15:30:12Z'));
    expect(recording).toMatchObject({
      version: RECORDING_VERSION,
      recordedAt: '2026-10-28T15:30:12.000Z',
      label: 'subir 3 y bajar 1',
    });
    expect(recording.frames).toHaveLength(1);
  });
});

describe('recordingFileName', () => {
  it('usa el modo del primer frame y la fecha', () => {
    const recorder = new SessionRecorder();
    recorder.add(trace({ engine: { mode: 'pinch', calibration: CAL } }));
    const recording = recorder.toRecording('', new Date('2026-10-28T15:30:12.345Z'));
    expect(recordingFileName(recording)).toBe('gestos-pinch-20261028-153012.json');
  });

  it('sin frames no tiene modo', () => {
    const recording = new SessionRecorder().toRecording('', new Date('2026-10-28T15:30:12Z'));
    expect(recordingFileName(recording)).toBe('gestos-sesion-20261028-153012.json');
  });
});

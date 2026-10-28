import { describe, expect, it } from 'vitest';
import { RECORDING_VERSION, type SessionRecording } from '@/application/vision';
import { expectedMoves, replayRecording } from './replay';

/**
 * Grabaciones reales (botón «Grabar» en desarrollo) como tests de regresión: el motor de gestos
 * tiene que emitir, frame por frame, los movimientos que guarda cada archivo. Ver
 * `recordings/README.md`.
 */
const recordings = Object.entries(
  import.meta.glob<SessionRecording>('./recordings/*.json', { eager: true, import: 'default' }),
);

describe('grabaciones de gestos', () => {
  if (recordings.length === 0) it.todo('todavía no hay grabaciones con una mano real');

  it.each(recordings)('%s', (_file, recording) => {
    expect(recording.version).toBe(RECORDING_VERSION);
    expect(replayRecording(recording)).toEqual(expectedMoves(recording));
  });
});

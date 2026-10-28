export type AudioCue = 'bead' | 'correct' | 'wrong' | 'lessonComplete';

export interface AudioPort {
  /** Debe llamarse dentro de un gesto del usuario (requisito de iOS y Chrome). */
  unlock(): Promise<void>;
  play(cue: AudioCue): void;
  setMuted(muted: boolean): void;
}

import type { AudioCue } from '@/application/ports';
import type { AudioBufferLike, AudioContextLike, AudioNodeLike } from './audioContextLike';

/** Ruido blanco con caída exponencial: la base del "clac" de madera. */
export function createClackBuffer(ctx: AudioContextLike, random: () => number): AudioBufferLike {
  const length = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (random() * 2 - 1) * Math.exp(-i / (length / 6));
  }
  return buffer;
}

function envelope(ctx: AudioContextLike, peak: number, duration: number, out: AudioNodeLike) {
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  gain.connect(out);
  return gain;
}

function tone(
  ctx: AudioContextLike,
  type: OscillatorType,
  frequency: number,
  delay: number,
  duration: number,
  peak: number,
): void {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, ctx.currentTime + delay);
  const gain = ctx.createGain();
  const t = ctx.currentTime + delay;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.setValueAtTime(peak, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

/** Reproduce un sonido sintetizado. `random` varía el clac ±5 % para que suene a madera. */
export function playCue(
  ctx: AudioContextLike,
  cue: AudioCue,
  clack: AudioBufferLike,
  random: () => number,
): void {
  switch (cue) {
    case 'bead': {
      const source = ctx.createBufferSource();
      source.buffer = clack;
      source.playbackRate.value = 0.95 + random() * 0.1;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2200;
      filter.Q.value = 6;
      source.connect(filter);
      filter.connect(envelope(ctx, 0.9, 0.06, ctx.destination));
      source.start();
      return;
    }
    case 'correct':
      tone(ctx, 'sine', 660, 0, 0.12, 0.25);
      tone(ctx, 'sine', 880, 0.09, 0.18, 0.25);
      return;
    case 'wrong':
      tone(ctx, 'triangle', 220, 0, 0.12, 0.3);
      tone(ctx, 'triangle', 165, 0.1, 0.22, 0.3);
      return;
    case 'lessonComplete':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(ctx, 'sine', f, i * 0.1, 0.25, 0.2);
      });
      return;
  }
}

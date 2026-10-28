import type { AudioCue, AudioPort } from '@/application/ports';
import type { AudioBufferLike, AudioContextLike } from './audioContextLike';
import { createClackBuffer, playCue } from './synth';

export interface WebAudioPortOptions {
  readonly createContext?: () => AudioContextLike;
  readonly random?: () => number;
  /** Para escuchar visibilitychange (por defecto, document). */
  readonly visibilityTarget?: VisibilityTarget;
}

export interface VisibilityTarget {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
}

const defaultContext = (): AudioContextLike => new AudioContext({ latencyHint: 'interactive' });

/**
 * Web Audio con desbloqueo por gesto: un solo AudioContext creado dentro de unlock(),
 * resume() + buffer silencioso de 1 muestra (truco de iOS) y resume() antes de cada sonido,
 * porque iOS suspende o "interrumpe" el contexto al ir a segundo plano o ante una llamada.
 */
export class WebAudioPort implements AudioPort {
  private ctx: AudioContextLike | null = null;
  private clack: AudioBufferLike | null = null;
  private muted = false;
  private readonly createContext: () => AudioContextLike;
  private readonly random: () => number;
  private readonly visibilityTarget: VisibilityTarget | undefined;

  constructor(options: WebAudioPortOptions = {}) {
    this.createContext = options.createContext ?? defaultContext;
    this.random = options.random ?? Math.random;
    this.visibilityTarget =
      options.visibilityTarget ?? (typeof document === 'undefined' ? undefined : document);
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  async unlock(): Promise<void> {
    if (!this.ctx) {
      const ctx = this.createContext();
      this.ctx = ctx;
      this.clack = createClackBuffer(ctx, this.random);
      const target = this.visibilityTarget;
      target?.addEventListener('visibilitychange', () => {
        if (target.visibilityState === 'visible') void this.resume();
      });
    }
    await this.resume();
    const silent = this.ctx.createBufferSource();
    silent.buffer = this.ctx.createBuffer(1, 1, 22_050);
    silent.connect(this.ctx.destination);
    silent.start(0);
  }

  play(cue: AudioCue): void {
    const { ctx, clack } = this;
    if (this.muted || !ctx || !clack) return;
    if (ctx.state !== 'running') void this.resume();
    playCue(ctx, cue, clack, this.random);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private async resume(): Promise<void> {
    if (!this.ctx || this.ctx.state === 'running' || this.ctx.state === 'closed') return;
    try {
      await this.ctx.resume();
    } catch {
      // Safari puede rechazar resume() fuera de un gesto; se reintenta en el próximo sonido.
    }
  }
}

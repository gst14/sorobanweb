import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AudioBufferLike,
  AudioContextLike,
  AudioNodeLike,
  AudioParamLike,
  BufferSourceLike,
  FilterLike,
  GainLike,
  OscillatorLike,
} from './audioContextLike';
import { type VisibilityTarget, WebAudioPort } from './WebAudioPort';

const noop = (): undefined => undefined;
const passThrough = (destination: AudioNodeLike): AudioNodeLike => destination;

class FakeParam implements AudioParamLike {
  value = 0;
  setValueAtTime(value: number): this {
    this.value = value;
    return this;
  }
  exponentialRampToValueAtTime(): this {
    return this;
  }
}

class FakeNode implements AudioNodeLike {
  connect(destination: AudioNodeLike): AudioNodeLike {
    return destination;
  }
}

class FakeContext implements AudioContextLike {
  state = 'suspended';
  currentTime = 0;
  sampleRate = 48_000;
  readonly destination = new FakeNode();
  readonly log: string[] = [];
  readonly sources: (BufferSourceLike & { started: boolean })[] = [];
  readonly oscillators: OscillatorLike[] = [];
  failResume = false;

  resume(): Promise<void> {
    this.log.push('resume');
    if (this.failResume) return Promise.reject(new Error('NotAllowedError'));
    this.state = 'running';
    return Promise.resolve();
  }

  createBuffer(_channels: number, length: number): AudioBufferLike {
    this.log.push(`buffer:${String(length)}`);
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }

  createBufferSource() {
    const log = this.log;
    const source = Object.assign(new FakeNode(), {
      buffer: null as AudioBufferLike | null,
      playbackRate: new FakeParam(),
      started: false,
      start() {
        source.started = true;
        log.push('source.start');
      },
    });
    this.sources.push(source);
    return source;
  }

  createGain(): GainLike {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }

  createBiquadFilter(): FilterLike {
    return {
      connect: passThrough,
      type: 'lowpass',
      frequency: new FakeParam(),
      Q: new FakeParam(),
    };
  }

  createOscillator(): OscillatorLike {
    const osc: OscillatorLike = {
      connect: passThrough,
      type: 'sine',
      frequency: new FakeParam(),
      start: noop,
      stop: noop,
    };
    this.oscillators.push(osc);
    return osc;
  }
}

class FakeVisibility implements VisibilityTarget {
  visibilityState: DocumentVisibilityState = 'visible';
  private listeners: (() => void)[] = [];
  addEventListener(_type: string, listener: () => void): void {
    this.listeners.push(listener);
  }
  fire(state: DocumentVisibilityState): void {
    this.visibilityState = state;
    for (const l of this.listeners) l();
  }
}

describe('WebAudioPort', () => {
  let ctx: FakeContext;
  let created: number;
  let visibility: FakeVisibility;
  let port: WebAudioPort;

  beforeEach(() => {
    ctx = new FakeContext();
    created = 0;
    visibility = new FakeVisibility();
    port = new WebAudioPort({
      createContext: () => {
        created += 1;
        return ctx;
      },
      random: () => 0.5,
      visibilityTarget: visibility,
    });
  });

  it('antes de unlock no crea contexto ni suena', () => {
    port.play('bead');
    expect(created).toBe(0);
    expect(port.unlocked).toBe(false);
  });

  it('unlock: crea un solo contexto, resume y reproduce un buffer silencioso de 1 muestra', async () => {
    await port.unlock();
    expect(ctx.log).toEqual(['buffer:1920', 'resume', 'buffer:1', 'source.start']);
    expect(port.unlocked).toBe(true);
    await port.unlock();
    expect(created).toBe(1);
  });

  it('play bead: buffer con playbackRate variado y filtro pasabanda', async () => {
    await port.unlock();
    port.play('bead');
    const source = ctx.sources.at(-1);
    expect(source?.started).toBe(true);
    expect(source?.playbackRate.value).toBeCloseTo(1);
  });

  it.each(['correct', 'wrong', 'lessonComplete'] as const)(
    'play %s usa osciladores',
    async (cue) => {
      await port.unlock();
      port.play(cue);
      expect(ctx.oscillators.length).toBeGreaterThanOrEqual(2);
    },
  );

  it('si el contexto está suspendido o interrumpido, resume antes de sonar', async () => {
    await port.unlock();
    ctx.log.length = 0;
    ctx.state = 'interrupted';
    port.play('bead');
    expect(ctx.log[0]).toBe('resume');
  });

  it('al volver a primer plano, resume', async () => {
    await port.unlock();
    ctx.state = 'suspended';
    ctx.log.length = 0;
    visibility.fire('hidden');
    expect(ctx.log).toEqual([]);
    visibility.fire('visible');
    expect(ctx.log).toEqual(['resume']);
  });

  it('mute silencia', async () => {
    await port.unlock();
    port.setMuted(true);
    const before = ctx.sources.length;
    port.play('bead');
    expect(ctx.sources.length).toBe(before);
    port.setMuted(false);
    port.play('bead');
    expect(ctx.sources.length).toBe(before + 1);
  });

  it('un resume rechazado (Safari fuera de gesto) no rompe', async () => {
    ctx.failResume = true;
    await expect(port.unlock()).resolves.toBeUndefined();
  });

  it('no intenta resume con el contexto cerrado', async () => {
    await port.unlock();
    ctx.state = 'closed';
    ctx.log.length = 0;
    await port.unlock();
    expect(ctx.log).not.toContain('resume');
  });

  it('funciona sin objetivo de visibilidad', async () => {
    const bare = new WebAudioPort({ createContext: () => new FakeContext() });
    await bare.unlock();
    expect(bare.unlocked).toBe(true);
  });
});

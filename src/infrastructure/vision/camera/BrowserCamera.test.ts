import { describe, expect, it } from 'vitest';
import type { VideoSink } from '@/application/ports';
import {
  BrowserCamera,
  CAMERA_CONSTRAINTS,
  type MediaDevicesLike,
  type MediaStreamLike,
  cameraError,
} from './BrowserCamera';

class FakeStream implements MediaStreamLike {
  readonly tracks = [
    {
      stopped: false,
      stop() {
        this.stopped = true;
      },
    },
  ];
  getTracks() {
    return this.tracks;
  }
  get stopped(): boolean {
    return this.tracks.every((t) => t.stopped);
  }
}

class FakeVideo implements VideoSink {
  srcObject: unknown = null;
  muted = false;
  readonly attributes = new Map<string, string>();
  videoWidth = 960;
  videoHeight = 540;
  playError: Error | null = null;
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
  play(): Promise<void> {
    return this.playError ? Promise.reject(this.playError) : Promise.resolve();
  }
}

const domError = (name: string) => Object.assign(new Error(name), { name });

function devices(result: FakeStream | Error) {
  const calls: MediaStreamConstraints[] = [];
  const mediaDevices: MediaDevicesLike = {
    getUserMedia: (constraints) => {
      calls.push(constraints);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  return { mediaDevices, calls };
}

describe('BrowserCamera', () => {
  it('abre la cámara frontal y prepara el video para iOS', async () => {
    const stream = new FakeStream();
    const { mediaDevices, calls } = devices(stream);
    const video = new FakeVideo();
    const result = await new BrowserCamera({ isSecureContext: true, mediaDevices }).open(video);

    expect(calls).toEqual([CAMERA_CONSTRAINTS]);
    expect(video.attributes.has('playsinline')).toBe(true);
    expect(video.attributes.has('autoplay')).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.srcObject).toBe(stream);
    if (!result.ok) throw new Error('debía abrir');
    expect(result.session).toMatchObject({ width: 960, height: 540 });

    result.session.stop();
    expect(stream.stopped).toBe(true);
    expect(video.srcObject).toBeNull();
  });

  it('sin HTTPS o sin getUserMedia ni lo intenta', async () => {
    const { mediaDevices, calls } = devices(new FakeStream());
    const video = new FakeVideo();
    expect(await new BrowserCamera({ isSecureContext: false, mediaDevices }).open(video)).toEqual({
      ok: false,
      error: 'insecure',
    });
    expect(
      await new BrowserCamera({ isSecureContext: true, mediaDevices: undefined }).open(video),
    ).toEqual({ ok: false, error: 'unsupported' });
    expect(calls).toEqual([]);
  });

  it.each([
    ['NotAllowedError', 'not-allowed'],
    ['NotFoundError', 'not-found'],
    ['NotReadableError', 'not-readable'],
    ['TypeError', 'unknown'],
  ] as const)('%s de getUserMedia → %s', async (name, error) => {
    const { mediaDevices } = devices(domError(name));
    const camera = new BrowserCamera({ isSecureContext: true, mediaDevices });
    expect(await camera.open(new FakeVideo())).toEqual({ ok: false, error });
  });

  it('si el video no arranca, apaga la cámara', async () => {
    const stream = new FakeStream();
    const { mediaDevices } = devices(stream);
    const video = new FakeVideo();
    video.playError = domError('AbortError');
    const result = await new BrowserCamera({ isSecureContext: true, mediaDevices }).open(video);
    expect(result).toEqual({ ok: false, error: 'not-readable' });
    expect(stream.stopped).toBe(true);
    expect(video.srcObject).toBeNull();
  });

  it('traduce errores por nombre, aunque no sean Error', () => {
    expect(cameraError({ name: 'SecurityError' })).toBe('not-allowed');
    expect(cameraError({ name: 'OverconstrainedError' })).toBe('not-found');
    expect(cameraError('boom')).toBe('unknown');
    expect(cameraError(null)).toBe('unknown');
  });
});

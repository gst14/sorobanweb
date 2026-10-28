import type { CameraError, CameraPort, CameraResult, VideoSink } from '@/application/ports';

/** Subconjunto de MediaStream y MediaDevices que usa la app; los reales lo cumplen. */
export interface MediaStreamLike {
  getTracks(): readonly { stop(): void }[];
}

export interface MediaDevicesLike {
  getUserMedia(constraints: MediaStreamConstraints): Promise<MediaStreamLike>;
}

export interface CameraEnv {
  readonly isSecureContext: boolean;
  /** En un contexto inseguro, `navigator.mediaDevices` es undefined. */
  readonly mediaDevices: MediaDevicesLike | undefined;
}

/**
 * Cámara frontal a 960×540 y 30 fps: con el delegado CPU, 640×360 no detecta manos y
 * 854×480 o más sí (§4.1).
 */
export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: 'user',
    width: { ideal: 960 },
    height: { ideal: 540 },
    frameRate: { ideal: 30 },
  },
};

const ERRORS_BY_NAME: Readonly<Record<string, CameraError>> = {
  NotAllowedError: 'not-allowed',
  SecurityError: 'not-allowed',
  NotFoundError: 'not-found',
  OverconstrainedError: 'not-found',
  NotReadableError: 'not-readable',
  AbortError: 'not-readable',
};

/** Traduce el error de getUserMedia (un DOMException, según el nombre) a un CameraError. */
export function cameraError(error: unknown): CameraError {
  const name =
    typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
  return ERRORS_BY_NAME[name] ?? 'unknown';
}

const stopAll = (stream: MediaStreamLike): void => {
  for (const track of stream.getTracks()) track.stop();
};

/** Adaptador de getUserMedia. Prepara el <video> para iOS: playsinline, muted y autoplay. */
export class BrowserCamera implements CameraPort {
  private readonly env: CameraEnv;

  constructor(env: CameraEnv) {
    this.env = env;
  }

  async open(video: VideoSink): Promise<CameraResult> {
    if (!this.env.isSecureContext) return { ok: false, error: 'insecure' };
    const devices = this.env.mediaDevices;
    if (!devices) return { ok: false, error: 'unsupported' };

    let stream: MediaStreamLike;
    try {
      stream = await devices.getUserMedia(CAMERA_CONSTRAINTS);
    } catch (error) {
      return { ok: false, error: cameraError(error) };
    }

    video.setAttribute('playsinline', '');
    video.setAttribute('autoplay', '');
    video.muted = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch (error) {
      stopAll(stream);
      video.srcObject = null;
      return { ok: false, error: cameraError(error) };
    }

    return {
      ok: true,
      session: {
        width: video.videoWidth,
        height: video.videoHeight,
        stop: () => {
          stopAll(stream);
          video.srcObject = null;
        },
      },
    };
  }
}

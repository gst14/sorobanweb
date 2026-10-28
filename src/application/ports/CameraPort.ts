/** Por qué no se pudo abrir la cámara. Cada caso ofrece volver al modo táctil. */
export type CameraError =
  | 'insecure' // no es HTTPS ni localhost
  | 'unsupported' // el navegador no tiene getUserMedia
  | 'not-allowed' // el usuario o la política negaron el permiso
  | 'not-found' // no hay cámara
  | 'not-readable' // la cámara está en uso o falló el hardware
  | 'unknown';

/**
 * El <video> donde se muestra la cámara. HTMLVideoElement lo cumple estructuralmente; así el
 * puerto no depende del DOM y los tests usan un fake.
 */
export interface VideoSink {
  srcObject: unknown;
  muted: boolean;
  setAttribute(name: string, value: string): void;
  play(): Promise<void>;
  readonly videoWidth: number;
  readonly videoHeight: number;
}

export interface CameraSession {
  /** Resolución real que entregó la cámara. */
  readonly width: number;
  readonly height: number;
  /** Apaga la cámara y desconecta el video. */
  stop(): void;
}

export type CameraResult =
  | { readonly ok: true; readonly session: CameraSession }
  | { readonly ok: false; readonly error: CameraError };

export interface CameraPort {
  /** Abre la cámara frontal en `video`. Llamarlo solo después de un gesto explícito del usuario. */
  open(video: VideoSink): Promise<CameraResult>;
}

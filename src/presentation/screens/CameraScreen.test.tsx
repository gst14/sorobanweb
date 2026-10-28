import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Landmark, TrackedHand, VisionError } from '@/application/ports';
import { hand } from '@/application/vision/testing/hands';
import { type TestServices, createTestServices } from '@/app/testing/testServices';
import { ServicesProvider } from '../ServicesProvider';
import { CameraScreen } from './CameraScreen';

const BOX = { left: 0.2, right: 0.8, beamY: 0.45, beadHeight: 0.04 };

/** Por defecto hay una calibración guardada para la imagen horizontal (en jsdom el video mide 0×0). */
function renderCamera({ calibrated = true }: { calibrated?: boolean } = {}) {
  const services = createTestServices();
  if (calibrated) services.fakeVision.saveCalibration('landscape', BOX);
  const onExit = vi.fn();
  const view = render(
    <ServicesProvider services={services}>
      <CameraScreen onExit={onExit} />
    </ServicesProvider>,
  );
  return { services, onExit, view, user: userEvent.setup({ delay: null }) };
}

const tracked = (t: number, index: Landmark): TrackedHand => ({
  ...hand({ t, index }),
  score: 0.9,
});

/** Sostiene el índice quieto algo más de un segundo, un frame cada 50 ms, desde `t0`. */
function holdIndex(services: TestServices, index: Landmark, t0: number): void {
  const session = lastSession(services);
  act(() => {
    for (let t = t0; t <= t0 + 1100; t += 50) session.frame(tracked(t, index), t);
  });
}

/** Cambia el tamaño que informa el video, como cuando se rota el teléfono. */
function resizeVideo(container: HTMLElement, width: number, height: number): void {
  const video = container.querySelector('video');
  if (!video) throw new Error('No hay video');
  Object.defineProperty(video, 'videoWidth', { configurable: true, value: width });
  Object.defineProperty(video, 'videoHeight', { configurable: true, value: height });
}

const lastSession = (services: TestServices) => {
  const session = services.fakeVision.sessions.at(-1);
  if (!session) throw new Error('No hay sesión');
  return session;
};

describe('CameraScreen', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('explica la privacidad y no pide la cámara hasta el tap', async () => {
    const { services, user } = renderCamera();
    expect(screen.getByText(/ningún frame de la cámara sale de él/)).toBeInTheDocument();
    expect(services.fakeVision.starts).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    expect(services.fakeVision.starts).toHaveLength(1);
    expect(services.fakeVision.starts[0]?.mode).toBe('push');
  });

  it('muestra la fase en curso y, al estar lista, si ve la mano', async () => {
    const { services, user } = renderCamera();
    services.fakeVision.phases = ['camera', 'benchmark'];
    services.fakeVision.hold();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    expect(screen.getByRole('status')).toHaveTextContent(/Mostrá una mano/);

    await act(async () => {
      services.fakeVision.release();
      await Promise.resolve();
    });
    expect(screen.getByRole('status')).toHaveTextContent('Acercá una mano a la cámara');
    expect(screen.getByText(/Usando la GPU/)).toBeInTheDocument();

    const session = lastSession(services);
    expect(session.onMove).not.toBeNull();
    act(() => {
      session.frame({ t: 0, landmarks: [], score: 0.9 });
    });
    expect(screen.getByRole('status')).toHaveTextContent('✓ Veo tu mano');
    act(() => {
      session.frame(null);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Acercá una mano a la cámara');
  });

  it('dibuja la mano sobre el video en cada frame y limpia al apagar', async () => {
    const ctx = {
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
    };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(ctx as unknown as CanvasRenderingContext2D);
    try {
      const { services, user } = renderCamera();
      await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
      const session = lastSession(services);
      expect(session.calibration.rodCount).toBe(7);

      const landmarks = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
      act(() => {
        session.frame({ t: 0, landmarks, score: 0.9 });
      });
      expect(ctx.strokeRect).toHaveBeenCalledOnce();
      expect(ctx.arc).toHaveBeenCalledTimes(22);
      act(() => {
        session.frame(null);
      });
      expect(ctx.strokeRect).toHaveBeenCalledTimes(2);
      expect(ctx.arc).toHaveBeenCalledTimes(22);

      ctx.clearRect.mockClear();
      await user.click(screen.getByRole('button', { name: 'Apagar cámara' }));
      expect(session.stopped).toBe(true);
      expect(ctx.clearRect).toHaveBeenCalledOnce();
    } finally {
      getContext.mockRestore();
    }
  });

  it.each<[VisionError, RegExp, boolean]>([
    ['not-allowed', /No hay permiso/, true],
    ['not-found', /No se encontró ninguna cámara/, true],
    ['not-readable', /La cámara está ocupada/, true],
    ['insecure', /conexión segura/, false],
    ['unsupported', /no permite usar la cámara/, false],
    ['unknown', /No se pudo abrir la cámara/, true],
    ['tracker', /reconocimiento de la mano/, true],
  ])('el error %s muestra su mensaje y la salida a táctil', async (error, title, retry) => {
    const { services, onExit, user } = renderCamera();
    services.fakeVision.error = error;
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(title);
    expect(screen.queryByRole('button', { name: 'Reintentar' }) !== null).toBe(retry);
    await user.click(screen.getByRole('button', { name: 'Volver a táctil' }));
    expect(onExit).toHaveBeenCalledOnce();
  });

  it('Reintentar vuelve a pedir la cámara', async () => {
    const { services, user } = renderCamera();
    services.fakeVision.error = 'not-readable';
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    services.fakeVision.error = null;
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(services.fakeVision.starts).toHaveLength(2);
    expect(screen.getByText(/Usando la GPU/)).toBeInTheDocument();
  });

  it('si el tracker se rompe en pleno uso, ofrece volver a táctil', async () => {
    const { services, user } = renderCamera();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    const session = lastSession(services);
    act(() => {
      session.fail();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/reconocimiento de la mano/);
    expect(session.stopped).toBe(true);
  });

  it('Apagar cámara y salir de la pantalla detienen la sesión', async () => {
    const { services, view, user } = renderCamera();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    await user.click(screen.getByRole('button', { name: 'Apagar cámara' }));
    expect(lastSession(services).stopped).toBe(true);
    expect(screen.getByRole('button', { name: 'Activar cámara' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    const second = lastSession(services);
    view.unmount();
    expect(second.stopped).toBe(true);
  });

  it('en desarrollo, Grabar escucha los frames de la sesión y Detener deja de escuchar', async () => {
    const { services, user } = renderCamera();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    await user.click(screen.getByRole('button', { name: 'Grabar' }));
    expect(lastSession(services).traceListener).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Detener y descargar' }));
    expect(lastSession(services).traceListener).toBeNull();
  });

  it('salir mientras arranca cancela el arranque', async () => {
    const { services, view, user } = renderCamera();
    services.fakeVision.hold();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    view.unmount();
    expect(services.fakeVision.starts[0]?.signal?.aborted).toBe(true);
    await act(async () => {
      services.fakeVision.release();
      await Promise.resolve();
    });
    expect(services.fakeVision.sessions).toHaveLength(0);
  });

  it('el modo compatibilidad se guarda y se usa en el próximo arranque', async () => {
    const { services, user } = renderCamera();
    const toggle = screen.getByRole('checkbox', { name: /Modo compatibilidad/ });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(services.fakeVision.compatibilityMode()).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    expect(screen.getByText(/Usando la CPU \(modo compatibilidad\)/)).toBeInTheDocument();
  });

  describe('calibración', () => {
    it('sin calibración guardada la pide, la guarda y después muestra el soroban de práctica', async () => {
      const { services, user } = renderCamera({ calibrated: false });
      await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
      expect(screen.getByRole('status')).toHaveTextContent(/paso 1 de 2/);
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

      holdIndex(services, { x: 0.2, y: 0.4 }, 0);
      expect(screen.getByRole('status')).toHaveTextContent(/Paso 2 de 2/);
      holdIndex(services, { x: 0.8, y: 0.4 }, 2000);

      expect(screen.getByRole('status')).toHaveTextContent('✓ Veo tu mano');
      const saved = services.fakeVision.savedCalibration('landscape');
      expect(saved?.left).toBeCloseTo(0.2);
      expect(saved?.right).toBeCloseTo(0.8);
      expect(lastSession(services).calibration).toEqual({ ...saved, rodCount: 7 });
      expect(screen.getByRole('group', { name: /soroban/i })).toBeInTheDocument();
    });

    it('avisa si el segundo punto queda muy cerca del primero', async () => {
      const { services, user } = renderCamera({ calibrated: false });
      await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
      holdIndex(services, { x: 0.4, y: 0.4 }, 0);
      holdIndex(services, { x: 0.5, y: 0.4 }, 2000);
      expect(screen.getByText(/muy cerca del primero/)).toBeInTheDocument();
      expect(services.fakeVision.savedCalibration('landscape')).toBeNull();
    });

    it('con una calibración guardada la usa sin pedir; Recalibrar se puede cancelar', async () => {
      const { services, user } = renderCamera();
      await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
      expect(lastSession(services).calibration).toEqual({ ...BOX, rodCount: 7 });
      expect(screen.getByRole('status')).toHaveTextContent('Acercá una mano a la cámara');

      await user.click(screen.getByRole('button', { name: 'Recalibrar' }));
      expect(screen.getByRole('status')).toHaveTextContent(/paso 1 de 2/);
      await user.click(screen.getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('button', { name: 'Recalibrar' })).toBeInTheDocument();
      expect(lastSession(services).calibration).toEqual({ ...BOX, rodCount: 7 });
    });

    it('al rotar pide calibrar solo si no hay calibración para esa orientación', async () => {
      const { services, view, user } = renderCamera();
      await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
      const session = lastSession(services);

      resizeVideo(view.container, 540, 960);
      act(() => {
        session.frame(null, 0);
      });
      expect(screen.getByRole('status')).toHaveTextContent(/paso 1 de 2/);
      expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();

      resizeVideo(view.container, 960, 540);
      act(() => {
        session.frame(null, 50);
      });
      expect(screen.getByRole('button', { name: 'Recalibrar' })).toBeInTheDocument();

      services.fakeVision.saveCalibration('portrait', { ...BOX, left: 0.1 });
      resizeVideo(view.container, 540, 960);
      act(() => {
        session.frame(null, 100);
      });
      expect(screen.getByRole('button', { name: 'Recalibrar' })).toBeInTheDocument();
      expect(session.calibration.left).toBe(0.1);
    });
  });

  it('los gestos mueven el soroban de práctica, salvo mientras se calibra', async () => {
    const { services, user } = renderCamera();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    const session = lastSession(services);
    const up = { rod: 0, deck: 'earth', delta: 2, finger: 'thumb', at: 0 } as const;

    act(() => {
      session.emit(up);
    });
    expect(screen.getByRole('group', { name: 'Soroban, valor 2' })).toBeInTheDocument();
    expect(services.fakeAudio.played).toEqual(['bead']);
    // Inválido: ya hay 2 cuentas arriba y se piden 3 más.
    act(() => {
      session.emit({ ...up, delta: 3 });
    });
    expect(services.fakeAudio.played).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Poner en cero' }));
    expect(screen.getByRole('group', { name: 'Soroban, valor 0' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Recalibrar' }));
    act(() => {
      session.emit(up);
    });
    expect(services.fakeAudio.played).toHaveLength(1);
  });

  it('el gesto elegido se guarda y cambia el modo sin reabrir la cámara', async () => {
    const { services, user } = renderCamera();
    expect(screen.getByRole('radio', { name: 'Empuje' })).toBeChecked();
    expect(screen.queryByRole('radio', { name: 'Táctil' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    const session = lastSession(services);

    await user.click(screen.getByRole('radio', { name: 'Puntero' }));
    expect(session.mode).toBe('pinch');
    expect(services.settings.getState().inputMode).toBe('pinch');
    expect(services.fakeVision.starts).toHaveLength(1);
  });

  it('con FPS bajos durante 3 s sugiere volver a táctil', async () => {
    const { services, onExit, user } = renderCamera();
    await user.click(screen.getByRole('button', { name: 'Activar cámara' }));
    const session = lastSession(services);
    act(() => {
      for (let t = 0; t <= 4000; t += 200) session.frame(null, t);
    });
    expect(screen.getByText('Seguimiento: mala')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Pasar a táctil' }));
    expect(onExit).toHaveBeenCalledOnce();
  });
});

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VisionError } from '@/application/ports';
import { type TestServices, createTestServices } from '@/app/testing/testServices';
import { ServicesProvider } from '../ServicesProvider';
import { CameraScreen } from './CameraScreen';

function renderCamera() {
  const services = createTestServices();
  const onExit = vi.fn();
  const view = render(
    <ServicesProvider services={services}>
      <CameraScreen onExit={onExit} />
    </ServicesProvider>,
  );
  return { services, onExit, view, user: userEvent.setup({ delay: null }) };
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
});

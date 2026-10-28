import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Move } from '@/domain';
import { type TestServices, createTestServices } from '@/app/testing/testServices';
import { ServicesProvider } from '../../ServicesProvider';
import { LessonScreen } from './LessonScreen';

const BOX = { left: 0.2, right: 0.8, beamY: 0.45, beadHeight: 0.04 };
const UP_TWO: Move = { rod: 0, deck: 'earth', delta: 2, finger: 'thumb', at: 0 };

/** "Poner 0–9": el soroban arranca en cero, así cualquier movimiento hacia arriba vale. */
function renderLesson({ calibrated = true }: { calibrated?: boolean } = {}) {
  const services = createTestServices();
  if (calibrated) services.fakeVision.saveCalibration('landscape', BOX);
  const view = render(
    <ServicesProvider services={services}>
      <LessonScreen lessonId="w0-set-1" onExit={vi.fn()} />
    </ServicesProvider>,
  );
  return { services, view, user: userEvent.setup({ delay: null }) };
}

const soroban = (services: TestServices) => {
  const session = services.session.getState().session;
  if (!session) throw new Error('No hay lección');
  return session.soroban;
};

const lastSession = (services: TestServices) => {
  const session = services.fakeVision.sessions.at(-1);
  if (!session) throw new Error('No hay sesión de cámara');
  return session;
};

/** Frames sin mano cada `1000 / fps` ms, de `from` a `to`. */
function frames(services: TestServices, fps: number, from: number, to: number): void {
  const session = lastSession(services);
  act(() => {
    for (let t = from; t <= to; t += 1000 / fps) session.frame(null, t);
  });
}

describe('LessonScreen con cámara', () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
  });

  it('en modo táctil no muestra la cámara; elegir Empuje la ofrece, persiste y usa 7 varillas', async () => {
    Object.assign(window, { innerWidth: 1280, innerHeight: 800 });
    const { services, user } = renderLesson();
    expect(screen.getByRole('radio', { name: 'Táctil' })).toBeChecked();
    expect(screen.queryByRole('button', { name: 'Activar cámara' })).not.toBeInTheDocument();
    expect(soroban(services).rodCount).toBe(17);

    await user.click(screen.getByRole('radio', { name: 'Empuje' }));
    expect(services.settings.getState().inputMode).toBe('push');
    expect(sessionStorage.getItem('soroban-settings')).toContain('"inputMode":"push"');
    expect(soroban(services).rodCount).toBe(7);
    // La cámara no se pide sola: hace falta el tap.
    expect(services.fakeVision.starts).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Activar cámara' })).toBeInTheDocument();
  });

  it('los gestos mueven el soroban del ejercicio, salvo mientras se calibra', async () => {
    const { services, user } = renderLesson({ calibrated: false });
    services.settings.getState().set({ inputMode: 'push' });
    await user.click(await screen.findByRole('button', { name: 'Activar cámara' }));
    expect(services.fakeVision.starts[0]?.mode).toBe('push');
    const session = lastSession(services);
    expect(session.calibration.rodCount).toBe(7);

    // Sin calibración guardada, primero se calibra y los gestos no mueven nada.
    expect(screen.getByText(/paso 1 de 2/)).toBeInTheDocument();
    act(() => {
      session.emit(UP_TWO);
    });
    expect(soroban(services).toNumber()).toBe(0);

    await user.click(screen.getByRole('button', { name: 'Apagar cámara' }));
    expect(session.stopped).toBe(true);
  });

  it('con calibración, un gesto mueve la cuenta y suena el clac', async () => {
    const { services, user } = renderLesson();
    services.settings.getState().set({ inputMode: 'push' });
    await user.click(await screen.findByRole('button', { name: 'Activar cámara' }));
    const session = lastSession(services);
    expect(session.calibration).toEqual({ ...BOX, rodCount: 7 });

    act(() => {
      session.emit(UP_TWO);
    });
    expect(soroban(services).toNumber()).toBe(2);
    expect(services.fakeAudio.played).toContain('bead');
  });

  it('cambiar a Puntero no reabre la cámara; volver a táctil la apaga', async () => {
    const { services, user } = renderLesson();
    services.settings.getState().set({ inputMode: 'push' });
    await user.click(await screen.findByRole('button', { name: 'Activar cámara' }));
    const session = lastSession(services);

    await user.click(screen.getByRole('radio', { name: 'Puntero' }));
    expect(session.mode).toBe('pinch');
    expect(services.fakeVision.starts).toHaveLength(1);

    await user.click(screen.getByRole('radio', { name: 'Táctil' }));
    expect(session.stopped).toBe(true);
    expect(screen.queryByRole('region', { name: 'Cámara' })).not.toBeInTheDocument();
  });

  it('muestra la calidad y, con FPS bajos durante 3 s, sugiere pasar a táctil', async () => {
    const { services, user } = renderLesson();
    services.settings.getState().set({ inputMode: 'push' });
    await user.click(await screen.findByRole('button', { name: 'Activar cámara' }));

    frames(services, 30, 0, 1000);
    expect(screen.getByText('Seguimiento: buena')).toBeInTheDocument();
    frames(services, 15, 1100, 2500);
    expect(screen.getByText('Seguimiento: regular')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pasar a táctil' })).not.toBeInTheDocument();

    frames(services, 5, 2700, 5000);
    expect(screen.getByText('Seguimiento: mala')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pasar a táctil' })).not.toBeInTheDocument();
    frames(services, 5, 5200, 7000);
    await user.click(screen.getByRole('button', { name: 'Pasar a táctil' }));

    expect(services.settings.getState().inputMode).toBe('touch');
    expect(lastSession(services).stopped).toBe(true);
  });

  it('ante un error de la cámara, Volver a táctil cambia el modo', async () => {
    const { services, user } = renderLesson();
    services.settings.getState().set({ inputMode: 'pinch' });
    services.fakeVision.error = 'not-allowed';
    await user.click(await screen.findByRole('button', { name: 'Activar cámara' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/No hay permiso/);

    await user.click(screen.getByRole('button', { name: 'Volver a táctil' }));
    expect(services.settings.getState().inputMode).toBe('touch');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { currentExercise } from '@/application/usecases';
import type { PlannedStep } from '@/domain';
import { ServicesProvider } from '@/presentation/ServicesProvider';
import { App } from './App';
import { type TestServices, createTestServices } from './testing/testServices';

function renderApp() {
  const services = createTestServices();
  render(
    <ServicesProvider services={services}>
      <App />
    </ServicesProvider>,
  );
  return services;
}

function currentOf(services: TestServices) {
  const session = services.session.getState().session;
  if (!session) throw new Error('No hay sesión');
  return currentExercise(session);
}

/** Ejecuta pasos canónicos con el teclado sobre el soroban (la selección arranca en la varilla 0). */
function playWithKeyboard(steps: readonly PlannedStep[]) {
  const svg = screen.getByRole('group', { name: /^Soroban/ });
  let selected = 0;
  for (const step of steps) {
    while (selected < step.rod) {
      fireEvent.keyDown(svg, { key: 'ArrowLeft' });
      selected += 1;
    }
    while (selected > step.rod) {
      fireEvent.keyDown(svg, { key: 'ArrowRight' });
      selected -= 1;
    }
    if (step.deck === 'heaven') {
      fireEvent.keyDown(svg, { key: step.delta > 0 ? 'ArrowDown' : 'ArrowUp', shiftKey: true });
    } else {
      for (let i = 0; i < Math.abs(step.delta); i++) {
        fireEvent.keyDown(svg, { key: step.delta > 0 ? 'ArrowUp' : 'ArrowDown' });
      }
    }
  }
}

describe('App', { timeout: 20_000 }, () => {
  beforeEach(() => {
    sessionStorage.clear();
    Object.assign(window, { innerWidth: 390, innerHeight: 844 });
  });

  it('Empezar desbloquea el audio y muestra los mundos con candados lineales', async () => {
    const services = renderApp();
    await userEvent.setup({ delay: null }).click(screen.getByRole('button', { name: 'Empezar' }));
    expect(services.fakeAudio.unlocked).toBe(true);
    expect(screen.getByRole('heading', { name: 'Mundos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Leer 0–9(?!9)/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Poner 0–9(?!9)/ })).toBeDisabled();
  });

  it('una lección de lectura completa con el teclado numérico aprueba y desbloquea la siguiente', async () => {
    const services = renderApp();
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    await user.click(screen.getByRole('button', { name: /^Leer 0–9(?!9)/ }));

    for (let i = 0; i < 10; i++) {
      const ex = currentOf(services);
      if (ex.kind !== 'read') throw new Error('se esperaba lectura');
      await user.click(screen.getByRole('button', { name: String(ex.target) }));
      await user.click(screen.getByRole('button', { name: 'OK' }));
      expect(screen.getByText('✓ ¡Correcto!')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Seguir' }));
    }

    expect(screen.getByRole('heading', { name: '¡Lección aprobada!' })).toBeInTheDocument();
    expect(screen.getByText('10 de 10 correctas')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Volver a los mundos' }));
    expect(await screen.findByRole('button', { name: /^Poner 0–9(?!9)/ })).toBeEnabled();
    expect(services.fakeProgress.results[0]).toMatchObject({ lessonId: 'w0-read-1', passed: true });
  });

  it('se completa una lección del mundo 1 operando el soroban', async () => {
    const services = renderApp();
    services.settings.getState().set({ unlockAll: true });
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    await user.click(screen.getByRole('button', { name: /Sumar directo/ }));

    for (let i = 0; i < 15; i++) {
      const ex = currentOf(services);
      if (ex.kind !== 'operation') throw new Error('se esperaba operación');
      act(() => {
        playWithKeyboard(ex.steps);
      });
      await user.click(screen.getByRole('button', { name: 'Listo' }));
      expect(screen.getByRole('status')).toHaveTextContent('✓ ¡Correcto!');
      await user.click(screen.getByRole('button', { name: 'Seguir' }));
    }

    expect(screen.getByRole('heading', { name: '¡Lección aprobada!' })).toBeInTheDocument();
    expect(services.fakeAudio.played.filter((c) => c === 'bead').length).toBeGreaterThan(0);
    expect(services.fakeProgress.attempts).toHaveLength(15);
  });

  it('un error muestra la respuesta y la regla para repasar', async () => {
    const services = renderApp();
    services.settings.getState().set({ unlockAll: true });
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    await user.click(screen.getByRole('button', { name: /Sumar con amigos del 5/ }));
    const ex = currentOf(services);
    if (ex.kind !== 'operation') throw new Error('se esperaba operación');

    await user.click(screen.getByRole('button', { name: 'Listo' }));
    const feedback = screen.getByRole('status');
    expect(feedback).toHaveTextContent(`✗ Era ${String(ex.expected)}`);
    expect(within(feedback).getByText(/Amigos del 5: \+\d = \+5 −\d/)).toBeInTheDocument();
  });

  it('Borrar vuelve el soroban al inicio del ejercicio y la flecha vuelve a los mundos', async () => {
    const services = renderApp();
    services.settings.getState().set({ unlockAll: true });
    const user = userEvent.setup({ delay: null });
    await user.click(screen.getByRole('button', { name: 'Empezar' }));
    await user.click(screen.getByRole('button', { name: /Restar directo/ }));
    const before = services.session.getState().session?.soroban.toNumber();
    act(() => {
      fireEvent.keyDown(screen.getByRole('group', { name: /^Soroban/ }), { key: 'ArrowDown' });
    });
    await user.click(screen.getByRole('button', { name: 'Borrar' }));
    expect(services.session.getState().session?.soroban.toNumber()).toBe(before);
    await user.click(screen.getByRole('button', { name: 'Salir de la lección' }));
    expect(screen.getByRole('heading', { name: 'Mundos' })).toBeInTheDocument();
    expect(services.session.getState().session).toBeNull();
  });
});

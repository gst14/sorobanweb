import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FrameTrace, TraceListener } from '@/application/ports';
import type { SessionRecording } from '@/application/vision';
import { defaultCalibration } from '@/application/vision';
import { Soroban } from '@/domain';
import { SessionRecorderControls } from './SessionRecorderControls';

const trace = (t: number, first = false): FrameTrace => ({
  t,
  hand: null,
  soroban: Soroban.create(7),
  moves: [],
  ...(first ? { engine: { mode: 'push', calibration: defaultCalibration(7) } } : {}),
});

function setup() {
  let listener: TraceListener | null = null;
  const calls: (TraceListener | null)[] = [];
  const setTraceListener = (l: TraceListener | null) => {
    listener = l;
    calls.push(l);
  };
  const view = render(
    <SessionRecorderControls
      setTraceListener={setTraceListener}
      now={() => new Date('2026-10-28T15:30:12Z')}
    />,
  );
  const emit = (t: number, first = false) => {
    act(() => listener?.(trace(t, first)));
  };
  return { view, calls, emit, listening: () => listener !== null };
}

describe('SessionRecorderControls', () => {
  const blobs: Blob[] = [];
  const downloads: string[] = [];

  beforeEach(() => {
    blobs.length = 0;
    downloads.length = 0;
    URL.createObjectURL = (blob: Blob) => {
      blobs.push(blob);
      return 'blob:grabacion';
    };
    URL.revokeObjectURL = () => undefined;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('graba los frames y al detener descarga el JSON con la descripción', async () => {
    const user = userEvent.setup();
    const { emit, listening } = setup();
    await user.type(screen.getByRole('textbox', { name: 'Qué vas a grabar' }), 'subir 3');
    await user.click(screen.getByRole('button', { name: 'Grabar' }));
    expect(listening()).toBe(true);
    emit(0, true);
    emit(1500);
    expect(screen.getByRole('status')).toHaveTextContent('Grabando · 1 s');
    await user.click(screen.getByRole('button', { name: 'Detener y descargar' }));

    expect(listening()).toBe(false);
    expect(downloads).toEqual(['gestos-push-20261028-153012.json']);
    const [blob] = blobs;
    const recording = JSON.parse((await blob?.text()) ?? '') as SessionRecording;
    expect(recording.label).toBe('subir 3');
    expect(recording.frames.map((f) => f.t)).toEqual([0, 1500]);
  });

  it('sin frames no descarga nada', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Grabar' }));
    await user.click(screen.getByRole('button', { name: 'Detener y descargar' }));
    expect(downloads).toEqual([]);
    expect(screen.getByRole('button', { name: 'Grabar' })).toBeInTheDocument();
  });

  it('avisa cuando la grabación se llena', async () => {
    const user = userEvent.setup();
    const { emit } = setup();
    await user.click(screen.getByRole('button', { name: 'Grabar' }));
    emit(0, true);
    for (let i = 1; i < 3600; i++) emit(i * 33);
    expect(screen.getByRole('status')).toHaveTextContent('Grabación llena');
  });

  it('al desmontar mientras graba, deja de escuchar', async () => {
    const user = userEvent.setup();
    const { view, listening } = setup();
    await user.click(screen.getByRole('button', { name: 'Grabar' }));
    view.unmount();
    expect(listening()).toBe(false);
  });

  it('al desmontar sin grabar, no toca el listener', () => {
    const { view, calls } = setup();
    view.unmount();
    expect(calls).toEqual([]);
  });
});

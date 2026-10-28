import { beforeEach, describe, expect, it } from 'vitest';
import type { Delegate, VisionPhase, VisionStartOptions } from '@/application/ports';
import { FakeCamera } from '@/application/testing/fakes';
import { defaultCalibration } from '@/application/vision';
import { Soroban } from '@/domain';
import type { BenchmarkResult, DelegateSample } from './tracker/delegateBenchmark';
import { DELEGATE_KEY, DelegatePreference } from './tracker/delegatePreference';
import type { HandTracker } from './tracker/MediaPipeHandTracker';
import { type VisionServiceDeps, VisionService } from './VisionService';

const sample = (delegate: Delegate, ok = true): DelegateSample => ({
  delegate,
  ok,
  frames: 30,
  detections: 30,
  medianMs: delegate === 'GPU' ? 8 : 20,
});

const benchmarkResult = (delegate: Delegate | null): BenchmarkResult => ({
  delegate,
  gpu: sample('GPU', delegate === 'GPU'),
  cpu: sample('CPU', delegate !== null),
});

function setup(over: Partial<VisionServiceDeps> & { fails?: readonly Delegate[] } = {}) {
  const camera = new FakeCamera();
  const preference = new DelegatePreference(localStorage);
  const loads: Delegate[] = [];
  const closed: Delegate[] = [];
  const benchmarks: number[] = [];
  const service = new VisionService({
    camera,
    preference,
    load: (delegate) => {
      loads.push(delegate);
      if (over.fails?.includes(delegate)) return Promise.reject(new Error('sin WebGL'));
      const tracker: HandTracker = {
        delegate,
        detect: () => null,
        close: () => {
          closed.push(delegate);
        },
      };
      return Promise.resolve(tracker);
    },
    benchmark: () => {
      benchmarks.push(1);
      return Promise.resolve(benchmarkResult('GPU'));
    },
    scheduler: { request: () => 1, cancel: () => undefined },
    ...over,
  });
  const phases: VisionPhase[] = [];
  const options = (extra: Partial<VisionStartOptions> = {}): VisionStartOptions => ({
    mode: 'push',
    getSoroban: () => Soroban.create(7),
    onPhase: (p) => phases.push(p),
    ...extra,
  });
  const video = document.createElement('video');
  return { service, camera, preference, loads, closed, benchmarks, phases, options, video };
}

describe('VisionService', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('sin delegado guardado, mide, guarda el ganador y carga el tracker con él', async () => {
    const { service, preference, loads, benchmarks, phases, options, video } = setup();
    const result = await service.start(video, options());
    if (!result.ok) throw new Error(result.error);
    expect(result.session.kind).toBe('vision');
    expect(result.session.delegate).toBe('GPU');
    expect(result.session.mode).toBe('push');
    expect(benchmarks).toHaveLength(1);
    expect(loads).toEqual(['GPU']);
    expect(phases).toEqual(['camera', 'benchmark', 'loading']);
    expect(preference.load()).toEqual({ delegate: 'GPU', source: 'benchmark' });
  });

  it('con un delegado guardado no vuelve a medir', async () => {
    const { service, preference, loads, benchmarks, phases, options, video } = setup();
    preference.force('CPU');
    const result = await service.start(video, options());
    expect(result.ok && result.session.delegate).toBe('CPU');
    expect(benchmarks).toHaveLength(0);
    expect(loads).toEqual(['CPU']);
    expect(phases).toEqual(['camera', 'loading']);
  });

  it('devuelve el error de la cámara sin cargar nada', async () => {
    const { service, camera, loads, options, video } = setup();
    camera.result = { ok: false, error: 'not-allowed' };
    expect(await service.start(video, options())).toEqual({ ok: false, error: 'not-allowed' });
    expect(loads).toEqual([]);
  });

  it('si la GPU guardada no carga, usa la CPU', async () => {
    const { service, preference, loads, options, video } = setup({ fails: ['GPU'] });
    localStorage.setItem(DELEGATE_KEY, JSON.stringify({ delegate: 'GPU', source: 'benchmark' }));
    const result = await service.start(video, options());
    expect(result.ok && result.session.delegate).toBe('CPU');
    expect(loads).toEqual(['GPU', 'CPU']);
    expect(preference.load()?.delegate).toBe('GPU');
  });

  it('si ningún delegado carga, falla con tracker y apaga la cámara', async () => {
    const { service, camera, preference, options, video } = setup({ fails: ['GPU', 'CPU'] });
    preference.force('GPU');
    expect(await service.start(video, options())).toEqual({ ok: false, error: 'tracker' });
    expect(camera.stops).toBe(1);
  });

  it('si la CPU forzada no carga, no prueba la GPU', async () => {
    const { service, preference, loads, options, video } = setup({ fails: ['CPU'] });
    preference.force('CPU');
    expect(await service.start(video, options())).toEqual({ ok: false, error: 'tracker' });
    expect(loads).toEqual(['CPU']);
  });

  it('si el benchmark no encuentra ningún delegado, falla con tracker', async () => {
    const { service, camera, preference, options, video } = setup({
      benchmark: () => Promise.resolve(benchmarkResult(null)),
    });
    expect(await service.start(video, options())).toEqual({ ok: false, error: 'tracker' });
    expect(camera.stops).toBe(1);
    expect(preference.load()).toBeNull();
  });

  it('si el benchmark falla porque el video no avanza, culpa a la cámara', async () => {
    const stalled = { ...sample('GPU', false), failure: 'stalled' as const };
    const { service, camera, options, video } = setup({
      benchmark: () =>
        Promise.resolve({ delegate: null, gpu: stalled, cpu: { ...stalled, delegate: 'CPU' } }),
    });
    expect(await service.start(video, options())).toEqual({ ok: false, error: 'not-readable' });
    expect(camera.stops).toBe(1);
  });

  it('cancelado antes de empezar no abre la cámara', async () => {
    const { service, camera, options, video } = setup();
    const controller = new AbortController();
    controller.abort();
    const result = await service.start(video, options({ signal: controller.signal }));
    expect(result).toEqual({ ok: false, error: 'aborted' });
    expect(camera.opens).toBe(0);
  });

  it('cancelado mientras se abre la cámara la apaga y no mide', async () => {
    const { service, camera, benchmarks, options, video } = setup();
    const controller = new AbortController();
    const result = await service.start(
      video,
      options({
        signal: controller.signal,
        onPhase: () => {
          controller.abort();
        },
      }),
    );
    expect(result).toEqual({ ok: false, error: 'aborted' });
    expect(camera.stops).toBe(1);
    expect(benchmarks).toHaveLength(0);
  });

  it('cancelado mientras carga el tracker lo cierra', async () => {
    const controller = new AbortController();
    const { service, camera, closed, options, video, preference } = setup({
      load: (delegate) => {
        controller.abort();
        return Promise.resolve({
          delegate,
          detect: () => null,
          close: () => closed.push(delegate),
        });
      },
    });
    preference.force('CPU');
    const result = await service.start(video, options({ signal: controller.signal }));
    expect(result).toEqual({ ok: false, error: 'aborted' });
    expect(camera.stops).toBe(1);
    expect(closed).toEqual(['CPU']);
  });

  it('cancelado durante el benchmark no carga el tracker', async () => {
    const controller = new AbortController();
    const { service, camera, loads, options, video } = setup({
      benchmark: () => {
        controller.abort();
        return Promise.resolve(benchmarkResult('GPU'));
      },
    });
    const result = await service.start(video, options({ signal: controller.signal }));
    expect(result).toEqual({ ok: false, error: 'aborted' });
    expect(camera.stops).toBe(1);
    expect(loads).toEqual([]);
  });

  it('stop() de la sesión apaga la cámara y cierra el tracker', async () => {
    const { service, camera, closed, options, video } = setup();
    const result = await service.start(video, options());
    if (!result.ok) throw new Error(result.error);
    result.session.start(() => undefined);
    result.session.stop();
    expect(camera.stops).toBe(1);
    expect(closed).toEqual(['GPU']);
  });

  it('sin calibración usa un recuadro centrado con las varillas del soroban', async () => {
    const { service, options, video } = setup();
    const result = await service.start(video, options({ getSoroban: () => Soroban.create(13) }));
    if (!result.ok) throw new Error(result.error);
    expect(result.session.calibration).toEqual(defaultCalibration(13));
  });

  it('el modo compatibilidad fuerza la CPU y desactivarlo vuelve a medir', () => {
    const { service, preference } = setup();
    expect(service.compatibilityMode()).toBe(false);
    service.setCompatibilityMode(true);
    expect(service.compatibilityMode()).toBe(true);
    expect(preference.load()).toEqual({ delegate: 'CPU', source: 'forced' });
    service.setCompatibilityMode(false);
    expect(service.compatibilityMode()).toBe(false);
    expect(preference.load()).toBeNull();
  });
});

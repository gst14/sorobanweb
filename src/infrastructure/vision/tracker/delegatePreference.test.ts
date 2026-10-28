import { describe, expect, it } from 'vitest';
import type { BenchmarkResult, DelegateSample } from './delegateBenchmark';
import { DELEGATE_KEY, DelegatePreference } from './delegatePreference';

const sample = (delegate: 'GPU' | 'CPU', medianMs: number): DelegateSample => ({
  delegate,
  ok: true,
  frames: 30,
  detections: 30,
  medianMs,
});

const result = (delegate: BenchmarkResult['delegate']): BenchmarkResult => ({
  delegate,
  gpu: sample('GPU', 9),
  cpu: sample('CPU', 31),
});

class MemoryStorage implements Storage {
  private data = new Map<string, string>();
  failWrites = false;
  get length() {
    return this.data.size;
  }
  clear() {
    this.data.clear();
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  key(i: number) {
    return [...this.data.keys()][i] ?? null;
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(key, value);
  }
}

describe('DelegatePreference', () => {
  it('sin nada guardado devuelve null', () => {
    expect(new DelegatePreference(new MemoryStorage()).load()).toBeNull();
  });

  it('guarda y lee la elección del benchmark', () => {
    const storage = new MemoryStorage();
    const saved = new DelegatePreference(storage).saveBenchmark(result('GPU'));
    expect(saved).toEqual({ delegate: 'GPU', source: 'benchmark', gpuMs: 9, cpuMs: 31 });
    expect(new DelegatePreference(storage).load()).toEqual({
      delegate: 'GPU',
      source: 'benchmark',
    });
  });

  it('un benchmark sin delegado no guarda nada', () => {
    const storage = new MemoryStorage();
    expect(new DelegatePreference(storage).saveBenchmark(result(null))).toBeNull();
    expect(storage.length).toBe(0);
  });

  it('el modo compatibilidad fuerza la CPU y el benchmark no lo pisa', () => {
    const pref = new DelegatePreference(new MemoryStorage());
    expect(pref.force('CPU')).toEqual({ delegate: 'CPU', source: 'forced' });
    expect(pref.saveBenchmark(result('GPU'))).toEqual({ delegate: 'CPU', source: 'forced' });
    expect(pref.load()?.delegate).toBe('CPU');
  });

  it('force(null) vuelve a la elección automática', () => {
    const pref = new DelegatePreference(new MemoryStorage());
    pref.force('CPU');
    expect(pref.force(null)).toBeNull();
    expect(pref.load()).toBeNull();
  });

  it.each([
    ['JSON roto', '{'],
    ['no es un objeto', '"GPU"'],
    ['null', 'null'],
    ['delegado desconocido', '{"delegate":"NPU","source":"benchmark"}'],
    ['origen desconocido', '{"delegate":"GPU","source":"otro"}'],
  ])('ignora basura en el storage: %s', (_name, raw) => {
    const storage = new MemoryStorage();
    storage.setItem(DELEGATE_KEY, raw);
    expect(new DelegatePreference(storage).load()).toBeNull();
  });

  it('sin storage o con el storage lleno, funciona solo en memoria', () => {
    const none = new DelegatePreference(undefined);
    expect(none.load()).toBeNull();
    expect(none.force('CPU')).toEqual({ delegate: 'CPU', source: 'forced' });
    none.clear();

    const full = new MemoryStorage();
    full.failWrites = true;
    expect(new DelegatePreference(full).force('CPU')?.delegate).toBe('CPU');
    expect(full.length).toBe(0);
  });

  it('un storage que lanza al leer o borrar no rompe', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    const pref = new DelegatePreference(broken);
    expect(pref.load()).toBeNull();
    expect(() => {
      pref.clear();
    }).not.toThrow();
  });
});

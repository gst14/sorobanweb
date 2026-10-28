import type { BenchmarkResult } from './delegateBenchmark';
import type { Delegate } from './MediaPipeHandTracker';

/** Delegado guardado: el que eligió el benchmark o el forzado por "modo compatibilidad". */
export interface DelegateChoice {
  readonly delegate: Delegate;
  readonly source: 'benchmark' | 'forced';
  /** Mediana de latencia por delegado, si salió del benchmark (para mostrar o depurar). */
  readonly gpuMs?: number;
  readonly cpuMs?: number;
}

export const DELEGATE_KEY = 'soroban-vision-delegate';

const isDelegate = (value: unknown): value is Delegate => value === 'GPU' || value === 'CPU';

/**
 * Delegado elegido para este dispositivo, en localStorage. Es una conveniencia: si el storage
 * no está o tiene basura, se vuelve a medir.
 */
export class DelegatePreference {
  private readonly storage: Storage | undefined;

  constructor(storage: Storage | undefined) {
    this.storage = storage;
  }

  load(): DelegateChoice | null {
    try {
      const raw = this.storage?.getItem(DELEGATE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) return null;
      const { delegate, source } = parsed as Partial<Record<keyof DelegateChoice, unknown>>;
      if (!isDelegate(delegate) || (source !== 'benchmark' && source !== 'forced')) return null;
      return { delegate, source };
    } catch {
      return null;
    }
  }

  /** Guarda lo que eligió el benchmark. No pisa una elección forzada. */
  saveBenchmark(result: BenchmarkResult): DelegateChoice | null {
    if (!result.delegate) return null;
    const current = this.load();
    if (current?.source === 'forced') return current;
    return this.save({
      delegate: result.delegate,
      source: 'benchmark',
      gpuMs: result.gpu.medianMs,
      cpuMs: result.cpu.medianMs,
    });
  }

  /** "Modo compatibilidad": fuerza la CPU, o con `null` vuelve a la elección automática. */
  force(delegate: Delegate | null): DelegateChoice | null {
    if (delegate) return this.save({ delegate, source: 'forced' });
    this.clear();
    return null;
  }

  clear(): void {
    try {
      this.storage?.removeItem(DELEGATE_KEY);
    } catch {
      // Sin storage no hay nada que borrar.
    }
  }

  private save(choice: DelegateChoice): DelegateChoice {
    try {
      this.storage?.setItem(DELEGATE_KEY, JSON.stringify(choice));
    } catch {
      // Storage lleno o bloqueado: la elección vale para esta sesión.
    }
    return choice;
  }
}

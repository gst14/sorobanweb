export interface StrokeSample {
  /** Posición vertical en alturas de cuenta (ver `beadUnits`). */
  readonly u: number;
  readonly t: number;
}

/**
 * Últimas muestras de un dedo dentro de una ventana de tiempo. El ancla es la más vieja:
 * si el dedo se desplaza lo suficiente respecto de ella, el movimiento fue rápido.
 * Una deriva lenta nunca acumula desplazamiento porque el ancla avanza con la ventana.
 */
export class StrokeWindow {
  private readonly windowMs: number;
  private samples: StrokeSample[] = [];

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  /** Agrega una muestra y devuelve el ancla (la muestra más vieja dentro de la ventana). */
  push(u: number, t: number): StrokeSample {
    const sample = { u, t };
    const kept = this.samples.filter((s) => t - s.t <= this.windowMs);
    this.samples = [...kept, sample];
    return kept[0] ?? sample;
  }

  /** Empieza un trazo nuevo en esta muestra. */
  restart(u: number, t: number): void {
    this.samples = [{ u, t }];
  }

  clear(): void {
    this.samples = [];
  }
}

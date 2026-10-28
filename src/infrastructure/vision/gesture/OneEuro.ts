/** Pasabajos exponencial de primer orden. */
class LowPass {
  private y: number | undefined;

  filter(x: number, alpha: number): number {
    this.y = this.y === undefined ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }

  last(): number | undefined {
    return this.y;
  }

  reset(): void {
    this.y = undefined;
  }
}

export interface OneEuroOptions {
  /** Corte mínimo en Hz: más bajo = menos temblor en reposo. */
  readonly minCutoff?: number;
  /** Cuánto sube el corte con la velocidad: más alto = menos retraso en movimientos rápidos. */
  readonly beta?: number;
  /** Corte del filtro de la derivada, en Hz. */
  readonly dCutoff?: number;
}

const alpha = (cutoff: number, dt: number): number => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** Filtro One Euro (Casiez, Roussel y Vogel, CHI 2012): corte adaptativo según la velocidad. */
export class OneEuro {
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;
  private readonly x = new LowPass();
  private readonly dx = new LowPass();
  private tPrev: number | undefined;

  constructor({ minCutoff = 1, beta = 0.02, dCutoff = 1 }: OneEuroOptions = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  /** Filtra `value` medido en el instante `tMs` (ms, monótono). */
  filter(value: number, tMs: number): number {
    const dt = this.tPrev === undefined ? 1 / 30 : Math.max(1e-3, (tMs - this.tPrev) / 1000);
    this.tPrev = tMs;
    const prev = this.x.last() ?? value;
    const edx = this.dx.filter((value - prev) / dt, alpha(this.dCutoff, dt));
    return this.x.filter(value, alpha(this.minCutoff + this.beta * Math.abs(edx), dt));
  }

  reset(): void {
    this.x.reset();
    this.dx.reset();
    this.tPrev = undefined;
  }
}

/** Un One Euro por eje para un punto 2D. */
export class OneEuro2D {
  private readonly fx: OneEuro;
  private readonly fy: OneEuro;

  constructor(options: OneEuroOptions = {}) {
    this.fx = new OneEuro(options);
    this.fy = new OneEuro(options);
  }

  filter(point: { readonly x: number; readonly y: number }, tMs: number): { x: number; y: number } {
    return { x: this.fx.filter(point.x, tMs), y: this.fy.filter(point.y, tMs) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}

import type { Calibration } from './calibration';

/**
 * Convierte la x del dedo en el índice de varilla (0 = derecha) dentro del ROI calibrado.
 * Con histéresis: la varilla actual se mantiene hasta que el dedo sale de ella por más de
 * `hysteresis` veces su ancho, para no saltar entre vecinas con el temblor.
 */
export class RodMapper {
  private readonly cal: Calibration;
  private readonly hysteresis: number;
  private current: number | null = null;

  constructor(cal: Calibration, hysteresis = 0.15) {
    this.cal = cal;
    this.hysteresis = hysteresis;
  }

  private get rodWidth(): number {
    return (this.cal.right - this.cal.left) / this.cal.rodCount;
  }

  /** Columna desde la izquierda → varilla desde la derecha. */
  private columnToRod(column: number): number {
    return this.cal.rodCount - 1 - column;
  }

  update(x: number): number | null {
    const w = this.rodWidth;
    if (this.current !== null) {
      const column = this.columnToRod(this.current);
      const from = this.cal.left + column * w - this.hysteresis * w;
      const to = this.cal.left + (column + 1) * w + this.hysteresis * w;
      if (x >= from && x <= to) return this.current;
    }
    const column = Math.floor((x - this.cal.left) / w);
    this.current = column >= 0 && column < this.cal.rodCount ? this.columnToRod(column) : null;
    return this.current;
  }

  reset(): void {
    this.current = null;
  }
}

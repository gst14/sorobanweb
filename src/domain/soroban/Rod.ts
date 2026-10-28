import { type Digit, type EarthCount, isEarthCount, toDigit, toEarthCount } from './Digit';

/**
 * Una varilla del soroban 1:4: una cuenta de cielo (vale 5) y cuatro de tierra (valen 1).
 * Inmutable. Cada dígito tiene una única configuración, así que no hay estados imposibles.
 */
export class Rod {
  readonly heaven: boolean;
  readonly earth: EarthCount;

  private constructor(heaven: boolean, earth: EarthCount) {
    this.heaven = heaven;
    this.earth = earth;
    Object.freeze(this);
  }

  static readonly ZERO: Rod = new Rod(false, 0);

  static of(d: Digit): Rod {
    return new Rod(d >= 5, toEarthCount(d % 5));
  }

  get value(): Digit {
    return toDigit((this.heaven ? 5 : 0) + this.earth);
  }

  /** ¿Se pueden mover n cuentas de tierra? n > 0 acerca cuentas a la viga. */
  canMoveEarth(n: number): boolean {
    return Number.isInteger(n) && isEarthCount(this.earth + n);
  }

  /** Sube (n > 0) o baja (n < 0) n cuentas de tierra. */
  moveEarth(n: number): Rod {
    if (!this.canMoveEarth(n)) {
      throw new RangeError(`No se pueden mover ${n} cuentas de tierra con ${this.earth} activas`);
    }
    return new Rod(this.heaven, toEarthCount(this.earth + n));
  }

  /** Baja (true) o sube (false) la cuenta del cielo. */
  setHeaven(on: boolean): Rod {
    return on === this.heaven ? this : new Rod(on, this.earth);
  }

  equals(other: Rod): boolean {
    return this.heaven === other.heaven && this.earth === other.earth;
  }
}

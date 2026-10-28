import { type Digit, digitsOf } from './Digit';
import { InvalidMoveError } from './errors';
import type { Move } from './Move';
import { Rod } from './Rod';

function assertRodCount(count: number): void {
  if (!Number.isInteger(count) || count < 3 || count % 2 === 0) {
    throw new RangeError(`La cantidad de varillas debe ser impar y ≥ 3: ${count}`);
  }
}

/**
 * Agregado inmutable del soroban. `rods[0]` es la varilla de la derecha.
 * La fuente de verdad son los dígitos; `toNumber()` solo vale mientras el resultado sea seguro.
 */
export class Soroban {
  readonly rods: readonly Rod[];
  /** Índice de la varilla de unidades (0 = la de la derecha). */
  readonly unitRod: number;

  private constructor(rods: readonly Rod[], unitRod: number) {
    this.rods = Object.freeze([...rods]);
    this.unitRod = unitRod;
    Object.freeze(this);
  }

  static create(rodCount: number, unitRod = 0): Soroban {
    assertRodCount(rodCount);
    return Soroban.fromRods(
      Array.from({ length: rodCount }, () => Rod.ZERO),
      unitRod,
    );
  }

  /** `digits[0]` es la varilla de la derecha. */
  static fromDigits(digits: readonly Digit[], unitRod = 0): Soroban {
    return Soroban.fromRods(
      digits.map((d) => Rod.of(d)),
      unitRod,
    );
  }

  /** Coloca el entero `n` a partir de la varilla de unidades. */
  static fromNumber(n: number, rodCount: number, unitRod = 0): Soroban {
    const digits = digitsOf(n);
    const empty = Soroban.create(rodCount, unitRod);
    if (unitRod + digits.length > rodCount) {
      throw new RangeError(`${n} no entra en ${rodCount} varillas con unidad en ${unitRod}`);
    }
    return digits.reduce<Soroban>((s, d, i) => s.withRod(unitRod + i, Rod.of(d)), empty);
  }

  private static fromRods(rods: readonly Rod[], unitRod: number): Soroban {
    assertRodCount(rods.length);
    if (!Number.isInteger(unitRod) || unitRod < 0 || unitRod >= rods.length) {
      throw new RangeError(`Varilla de unidades fuera de rango: ${unitRod}`);
    }
    return new Soroban(rods, unitRod);
  }

  get rodCount(): number {
    return this.rods.length;
  }

  digits(): readonly Digit[] {
    return Object.freeze(this.rods.map((r) => r.value));
  }

  rodAt(index: number): Rod {
    const rod = this.rods[index];
    if (rod === undefined) throw new RangeError(`Varilla inexistente: ${index}`);
    return rod;
  }

  rodValue(index: number): Digit {
    return this.rodAt(index).value;
  }

  /** Valor leído desde la varilla de unidades: Σ dígito·10^(i − unitRod). */
  toNumber(): number {
    const scaled = this.rods.reduceRight((acc, rod) => acc * 10 + rod.value, 0);
    if (!Number.isSafeInteger(scaled)) {
      throw new RangeError('El valor del soroban excede Number.MAX_SAFE_INTEGER');
    }
    return scaled / 10 ** this.unitRod;
  }

  canApply(move: Move): boolean {
    return this.rejectionReason(move) === null;
  }

  apply(move: Move): Soroban {
    const reason = this.rejectionReason(move);
    if (reason !== null) throw new InvalidMoveError(move, reason);
    const rod = this.rodAt(move.rod);
    const next = move.deck === 'earth' ? rod.moveEarth(move.delta) : rod.setHeaven(move.delta > 0);
    return this.withRod(move.rod, next);
  }

  withRod(index: number, rod: Rod): Soroban {
    this.rodAt(index);
    return new Soroban(
      this.rods.map((r, i) => (i === index ? rod : r)),
      this.unitRod,
    );
  }

  clear(): Soroban {
    return Soroban.create(this.rodCount, this.unitRod);
  }

  equals(other: Soroban): boolean {
    return (
      this.unitRod === other.unitRod &&
      this.rodCount === other.rodCount &&
      this.rods.every((r, i) => r.equals(other.rodAt(i)))
    );
  }

  private rejectionReason(move: Move): string | null {
    const rod = this.rods[move.rod];
    if (rod === undefined) return 'la varilla no existe';
    if (move.deck === 'earth') {
      return rod.canMoveEarth(move.delta) ? null : 'no hay suficientes cuentas de tierra';
    }
    const lowering = move.delta > 0;
    return rod.heaven === lowering ? 'la cuenta del cielo ya está en esa posición' : null;
  }
}

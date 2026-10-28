import type { Rng } from '@/domain';

/** Crea un Rng; sin semilla, la implementación elige una. */
export type RngFactory = (seed?: number) => Rng;

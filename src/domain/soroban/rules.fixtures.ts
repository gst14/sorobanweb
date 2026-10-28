import type { Rule } from './rules';

/**
 * Tabla esperada escrita a mano (no derivada de la fórmula).
 * Filas: valor actual v = 0..9. Columnas: d = 1..9.
 * D = direct, 5 = five, 10 = ten, C = combined.
 */
const ADD = `
  D  D  D  D  D  D  D  D  D
  D  D  D  5  D  D  D  D  10
  D  D  5  5  D  D  D  10 10
  D  5  5  5  D  D  10 10 10
  5  5  5  5  D  10 10 10 10
  D  D  D  D  10 C  C  C  C
  D  D  D  10 10 C  C  C  10
  D  D  10 10 10 C  C  10 10
  D  10 10 10 10 C  10 10 10
  10 10 10 10 10 10 10 10 10
`;

const SUB = `
  10 10 10 10 10 10 10 10 10
  D  10 10 10 10 C  10 10 10
  D  D  10 10 10 C  C  10 10
  D  D  D  10 10 C  C  C  10
  D  D  D  D  10 C  C  C  C
  5  5  5  5  D  10 10 10 10
  D  5  5  5  D  D  10 10 10
  D  D  5  5  D  D  D  10 10
  D  D  D  5  D  D  D  D  10
  D  D  D  D  D  D  D  D  D
`;

const SYMBOLS: Readonly<Record<string, Rule>> = {
  D: 'direct',
  '5': 'five',
  '10': 'ten',
  C: 'combined',
};

function parse(table: string): readonly (readonly Rule[])[] {
  return table
    .trim()
    .split('\n')
    .map((line) =>
      line
        .trim()
        .split(/\s+/)
        .map((sym) => {
          const rule = SYMBOLS[sym];
          if (rule === undefined) throw new Error(`Símbolo desconocido en la tabla: ${sym}`);
          return rule;
        }),
    );
}

/** EXPECTED_ADD[v][d − 1] */
export const EXPECTED_ADD = parse(ADD);
/** EXPECTED_SUB[v][d − 1] */
export const EXPECTED_SUB = parse(SUB);

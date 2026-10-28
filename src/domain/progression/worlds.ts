import { type Exercise, type Term, operationExercise } from '../exercises/Exercise';
import { type ChainConfig, generateChain } from '../exercises/generators/chain';
import { type ReadingConfig, generateReading } from '../exercises/generators/reading';
import { generateSingleRule } from '../exercises/generators/singleRule';
import type { Rng } from '../exercises/Rng';
import { type Operation, RULE_ITEMS, type Rule, type RuleItem } from '../soroban/rules';

export type LessonSource =
  | { readonly kind: 'reading'; readonly config: ReadingConfig }
  | { readonly kind: 'singleRule'; readonly items: readonly RuleItem[] }
  | { readonly kind: 'chain'; readonly config: ChainConfig }
  | {
      readonly kind: 'fixed';
      readonly operations: readonly { readonly start: number; readonly terms: readonly Term[] }[];
    };

/** Reglas de jefe en versión simple (fase 1): vidas y/o tiempo límite. */
export interface BossRules {
  readonly lives?: number;
  readonly timeLimitMs?: number;
}

export interface Lesson {
  readonly id: string;
  readonly worldId: WorldId;
  readonly title: string;
  readonly source: LessonSource;
  readonly exerciseCount: number;
  /** Proporción de aciertos para aprobar (0..1). */
  readonly passRatio: number;
  /** Reglas que pueden aparecer en la lección (incluidas las de llevadas o préstamos). */
  readonly allowedRules: readonly Rule[];
  readonly boss?: BossRules;
}

export type WorldId = 0 | 1 | 2 | 3;

export interface World {
  readonly id: WorldId;
  readonly title: string;
  /** Rango interno inspirado en kyu (no es una certificación oficial). */
  readonly rank: string;
  readonly lessons: readonly Lesson[];
}

const PASS_RATIO = 0.8;

const items = (op: Operation, rule: Rule): readonly RuleItem[] =>
  RULE_ITEMS.filter((i) => i.op === op && i.rule === rule);

const BOTH: readonly Operation[] = ['add', 'sub'];
const DIRECT: readonly Rule[] = ['direct'];
const UP_TO_FIVE: readonly Rule[] = ['direct', 'five'];
const UP_TO_TEN: readonly Rule[] = ['direct', 'five', 'ten'];

type LessonSpec = Omit<Lesson, 'worldId' | 'passRatio'> & { readonly passRatio?: number };

const world = (id: WorldId, title: string, rank: string, lessons: readonly LessonSpec[]): World =>
  Object.freeze({
    id,
    title,
    rank,
    lessons: Object.freeze(
      lessons.map((l) => Object.freeze({ passRatio: PASS_RATIO, ...l, worldId: id })),
    ),
  });

const reading = (kind: 'read' | 'set', maxDigits: 1 | 2 | 3): LessonSource => ({
  kind: 'reading',
  config: { kind, maxDigits },
});

const op = (start: number, sign: Operation, value: number) => ({
  start,
  terms: [{ op: sign, value }],
});

export const WORLDS: readonly World[] = Object.freeze([
  world(0, 'Las cuentas', '15 kyu', [
    {
      id: 'w0-read-1',
      title: 'Leer 0–9',
      source: reading('read', 1),
      exerciseCount: 10,
      allowedRules: [],
    },
    {
      id: 'w0-set-1',
      title: 'Poner 0–9',
      source: reading('set', 1),
      exerciseCount: 10,
      allowedRules: DIRECT,
    },
    {
      id: 'w0-read-2',
      title: 'Leer 0–99',
      source: reading('read', 2),
      exerciseCount: 10,
      allowedRules: [],
    },
    {
      id: 'w0-set-2',
      title: 'Poner 0–99',
      source: reading('set', 2),
      exerciseCount: 10,
      allowedRules: DIRECT,
    },
    {
      id: 'w0-read-3',
      title: 'Leer 0–999',
      source: reading('read', 3),
      exerciseCount: 10,
      allowedRules: [],
    },
    {
      id: 'w0-set-3',
      title: 'Poner 0–999',
      source: reading('set', 3),
      exerciseCount: 10,
      allowedRules: DIRECT,
    },
    {
      id: 'w0-boss',
      title: 'Jefe: lectura relámpago',
      source: reading('read', 3),
      exerciseCount: 20,
      allowedRules: [],
      boss: { timeLimitMs: 60_000 },
    },
  ]),
  world(1, 'Directo', '14–13 kyu', [
    {
      id: 'w1-add',
      title: 'Sumar directo',
      source: { kind: 'singleRule', items: items('add', 'direct') },
      exerciseCount: 15,
      allowedRules: DIRECT,
    },
    {
      id: 'w1-sub',
      title: 'Restar directo',
      source: { kind: 'singleRule', items: items('sub', 'direct') },
      exerciseCount: 15,
      allowedRules: DIRECT,
    },
    {
      id: 'w1-mix',
      title: 'Mezcla directa',
      source: { kind: 'chain', config: { terms: 3, digits: 1, ops: BOTH, allowed: DIRECT } },
      exerciseCount: 10,
      allowedRules: DIRECT,
    },
    {
      id: 'w1-mix-2',
      title: 'Directo con 2 cifras',
      source: { kind: 'chain', config: { terms: 3, digits: 2, ops: BOTH, allowed: DIRECT } },
      exerciseCount: 10,
      allowedRules: DIRECT,
    },
    {
      id: 'w1-boss',
      title: 'Jefe: 10 operaciones encadenadas',
      source: { kind: 'chain', config: { terms: 10, digits: 1, ops: BOTH, allowed: DIRECT } },
      exerciseCount: 1,
      passRatio: 1,
      allowedRules: DIRECT,
      boss: { lives: 1 },
    },
  ]),
  world(2, 'Amigos del 5', '12–11 kyu', [
    {
      id: 'w2-add',
      title: 'Sumar con amigos del 5',
      source: { kind: 'singleRule', items: items('add', 'five') },
      exerciseCount: 15,
      allowedRules: UP_TO_FIVE,
    },
    {
      id: 'w2-sub',
      title: 'Restar con amigos del 5',
      source: { kind: 'singleRule', items: items('sub', 'five') },
      exerciseCount: 15,
      allowedRules: UP_TO_FIVE,
    },
    {
      id: 'w2-mix',
      title: 'Mezcla: directo y amigos del 5',
      source: {
        kind: 'chain',
        config: { terms: 4, digits: 1, ops: BOTH, allowed: UP_TO_FIVE, require: 'five' },
      },
      exerciseCount: 10,
      allowedRules: UP_TO_FIVE,
    },
    {
      id: 'w2-boss',
      title: 'Jefe: directo + 5 con 3 vidas',
      source: {
        kind: 'chain',
        config: { terms: 5, digits: 1, ops: BOTH, allowed: UP_TO_FIVE, require: 'five' },
      },
      exerciseCount: 10,
      allowedRules: UP_TO_FIVE,
      boss: { lives: 3 },
    },
  ]),
  world(3, 'Amigos del 10', '10–9 kyu', [
    {
      id: 'w3-add',
      title: 'Sumar llevando',
      source: { kind: 'singleRule', items: items('add', 'ten') },
      exerciseCount: 15,
      allowedRules: DIRECT.concat('ten'),
    },
    {
      id: 'w3-sub',
      title: 'Restar pidiendo prestado',
      source: { kind: 'singleRule', items: items('sub', 'ten') },
      exerciseCount: 15,
      allowedRules: DIRECT.concat('ten'),
    },
    {
      id: 'w3-mix',
      title: 'Mezcla con llevadas',
      source: {
        kind: 'chain',
        config: { terms: 4, digits: 1, ops: BOTH, allowed: UP_TO_TEN, require: 'ten' },
      },
      exerciseCount: 10,
      allowedRules: UP_TO_TEN,
    },
    {
      id: 'w3-mix-2',
      title: 'Llevadas con 2 cifras',
      source: {
        kind: 'chain',
        config: { terms: 3, digits: 2, ops: BOTH, allowed: UP_TO_TEN, require: 'ten' },
      },
      exerciseCount: 10,
      allowedRules: UP_TO_TEN,
    },
    {
      id: 'w3-boss',
      title: 'Jefe: cascada de llevadas',
      source: {
        kind: 'fixed',
        operations: [
          op(9, 'add', 1),
          op(99, 'add', 1),
          op(999, 'add', 1),
          op(90, 'add', 10),
          op(199, 'add', 1),
          op(990, 'add', 10),
          op(100, 'sub', 1),
          op(1000, 'sub', 1),
          op(500, 'sub', 1),
          op(1000, 'sub', 10),
        ],
      },
      exerciseCount: 10,
      allowedRules: UP_TO_TEN,
      boss: { lives: 3 },
    },
  ]),
]);

/** Todas las lecciones en orden de desbloqueo. */
export const LESSONS: readonly Lesson[] = Object.freeze(WORLDS.flatMap((w) => w.lessons));

export function lessonById(id: string): Lesson {
  const lesson = LESSONS.find((l) => l.id === id);
  if (!lesson) throw new RangeError(`Lección desconocida: ${id}`);
  return lesson;
}

/** Genera los ejercicios de una lección. Mismo rng → mismos ejercicios. */
export function generateLesson(lesson: Lesson, rng: Rng): readonly Exercise[] {
  const source = lesson.source;
  const exerciseId = (i: number) => `${lesson.id}#${String(i + 1)}`;
  if (source.kind === 'fixed') {
    return Object.freeze(
      source.operations.map((o, i) => operationExercise(exerciseId(i), o.start, o.terms)),
    );
  }
  return Object.freeze(
    Array.from({ length: lesson.exerciseCount }, (_, i): Exercise => {
      const id = exerciseId(i);
      switch (source.kind) {
        case 'reading':
          return generateReading(rng, source.config, id);
        case 'singleRule':
          return generateSingleRule(rng, source.items, id);
        case 'chain':
          return generateChain(rng, source.config, id);
      }
    }),
  );
}

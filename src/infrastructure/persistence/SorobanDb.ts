import Dexie, { type EntityTable } from 'dexie';
import type { AttemptRecord, LessonResultRecord } from '@/application/ports';

export interface AttemptRow extends AttemptRecord {
  id?: number;
}

export interface LessonResultRow extends LessonResultRecord {
  id?: number;
}

/** Fase 3: caja de Leitner por ítem (op:regla:d). */
export interface SkillRow {
  key: string;
  box: number;
  nextDue: number;
}

/** Fase 3: XP, racha, congeladores. */
export interface ProfileRow {
  id: 'me';
  xp: number;
  streak: number;
}

export class SorobanDb extends Dexie {
  declare attempts: EntityTable<AttemptRow, 'id'>;
  declare lessonResults: EntityTable<LessonResultRow, 'id'>;
  declare skills: EntityTable<SkillRow, 'key'>;
  declare profile: EntityTable<ProfileRow, 'id'>;

  constructor(name = 'soroban-trainer') {
    super(name);
    // Los booleanos no son claves válidas de IndexedDB: `passed` se guarda pero no se indexa.
    this.version(1).stores({
      attempts: '++id, lessonId, exerciseId, at',
      lessonResults: '++id, lessonId, at',
      skills: 'key, nextDue',
      profile: 'id',
    });
  }
}

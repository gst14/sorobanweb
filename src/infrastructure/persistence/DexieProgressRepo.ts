import type { AttemptRecord, LessonResultRecord, ProgressRepo } from '@/application/ports';
import type { SorobanDb } from './SorobanDb';

export class DexieProgressRepo implements ProgressRepo {
  private readonly db: SorobanDb;

  constructor(db: SorobanDb) {
    this.db = db;
  }

  async saveAttempt(attempt: AttemptRecord): Promise<void> {
    await this.db.attempts.add({ ...attempt });
  }

  async saveLessonResult(result: LessonResultRecord): Promise<void> {
    await this.db.lessonResults.add({ ...result });
  }

  async passedLessons(): Promise<ReadonlySet<string>> {
    const rows = await this.db.lessonResults.filter((r) => r.passed).toArray();
    return new Set(rows.map((r) => r.lessonId));
  }
}

/** Pide al navegador que no borre el progreso. Devuelve si quedó persistente. */
export async function requestPersistentStorage(
  storage?: Pick<StorageManager, 'persist' | 'persisted'>,
): Promise<boolean> {
  storage ??= 'storage' in navigator ? navigator.storage : undefined;
  if (!storage) return false;
  try {
    return (await storage.persisted()) || (await storage.persist());
  } catch {
    return false;
  }
}

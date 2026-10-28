import { createRng } from '@/domain';
import type { AudioCue, AudioPort } from '../ports/AudioPort';
import type { CameraPort, CameraResult } from '../ports/CameraPort';
import type { Clock } from '../ports/Clock';
import type { AttemptRecord, LessonResultRecord, ProgressRepo } from '../ports/ProgressRepo';
import type { RngFactory } from '../ports/RngFactory';

export class FakeClock implements Clock {
  private t: number;
  constructor(start = 0) {
    this.t = start;
  }
  now(): number {
    return this.t;
  }
  advance(ms: number): void {
    this.t += ms;
  }
}

export class FakeAudio implements AudioPort {
  readonly played: AudioCue[] = [];
  unlocked = false;
  muted = false;
  unlock(): Promise<void> {
    this.unlocked = true;
    return Promise.resolve();
  }
  play(cue: AudioCue): void {
    if (!this.muted) this.played.push(cue);
  }
  setMuted(muted: boolean): void {
    this.muted = muted;
  }
}

export class InMemoryProgressRepo implements ProgressRepo {
  readonly attempts: AttemptRecord[] = [];
  readonly results: LessonResultRecord[] = [];
  saveAttempt(attempt: AttemptRecord): Promise<void> {
    this.attempts.push(attempt);
    return Promise.resolve();
  }
  saveLessonResult(result: LessonResultRecord): Promise<void> {
    this.results.push(result);
    return Promise.resolve();
  }
  passedLessons(): Promise<ReadonlySet<string>> {
    return Promise.resolve(new Set(this.results.filter((r) => r.passed).map((r) => r.lessonId)));
  }
}

export const seededRng: RngFactory = (seed = 1) => createRng(seed);

/** Cámara que devuelve un resultado fijo y cuenta las aperturas. */
export class FakeCamera implements CameraPort {
  opens = 0;
  stops = 0;
  result: CameraResult = {
    ok: true,
    session: {
      width: 960,
      height: 540,
      stop: () => {
        this.stops++;
      },
    },
  };
  open(): Promise<CameraResult> {
    this.opens++;
    return Promise.resolve(this.result);
  }
}

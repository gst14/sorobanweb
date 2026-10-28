import type { CalibrationBox, CameraOrientation } from '@/application/ports';

export const CALIBRATION_KEY = 'soroban-vision-calibration';

type Saved = Partial<Record<CameraOrientation, CalibrationBox>>;

const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

/** Una calibración leída del storage, o null si no tiene sentido. */
function parseBox(value: unknown): CalibrationBox | null {
  if (typeof value !== 'object' || value === null) return null;
  const { left, right, beamY, beadHeight } = value as Partial<
    Record<keyof CalibrationBox, unknown>
  >;
  if (!isUnit(left) || !isUnit(right) || !isUnit(beamY) || !isUnit(beadHeight)) return null;
  if (left >= right || beadHeight === 0) return null;
  return { left, right, beamY, beadHeight };
}

/**
 * Calibraciones de este dispositivo, una por orientación, en localStorage. Como el delegado, es
 * una conveniencia: si el storage no está o tiene basura, se vuelve a calibrar.
 */
export class CalibrationStore {
  private readonly storage: Storage | undefined;

  constructor(storage: Storage | undefined) {
    this.storage = storage;
  }

  load(orientation: CameraOrientation): CalibrationBox | null {
    return parseBox(this.read()[orientation]);
  }

  save(orientation: CameraOrientation, box: CalibrationBox): void {
    const { left, right, beamY, beadHeight } = box;
    try {
      this.storage?.setItem(
        CALIBRATION_KEY,
        JSON.stringify({ ...this.read(), [orientation]: { left, right, beamY, beadHeight } }),
      );
    } catch {
      // Storage lleno o bloqueado: la calibración vale mientras la cámara siga abierta.
    }
  }

  private read(): Saved {
    try {
      const raw = this.storage?.getItem(CALIBRATION_KEY);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }
}

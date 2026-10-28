import { useSyncExternalStore } from 'react';

export type RodCount = 7 | 13 | 17;

export const DESKTOP_MIN_WIDTH = 1024;

/** 7 varillas en mobile vertical, 13 en mobile horizontal, 17 en desktop. */
export function rodCountFor(width: number, height: number): RodCount {
  if (width >= DESKTOP_MIN_WIDTH) return 17;
  return width > height ? 13 : 7;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  return () => {
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
  };
};

const snapshot = (): RodCount => rodCountFor(window.innerWidth, window.innerHeight);

/** Cantidad de varillas según el viewport; se actualiza al rotar o redimensionar. */
export const useRodLayout = (): RodCount => useSyncExternalStore(subscribe, snapshot, () => 7);

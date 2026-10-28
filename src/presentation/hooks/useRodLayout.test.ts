import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { rodCountFor, useRodLayout } from './useRodLayout';

const resize = (width: number, height: number) => {
  Object.assign(window, { innerWidth: width, innerHeight: height });
  window.dispatchEvent(new Event('resize'));
};

describe('rodCountFor', () => {
  it.each([
    [360, 780, 7],
    [390, 844, 7],
    [844, 390, 13],
    [1023, 700, 13],
    [1024, 768, 17],
    [1440, 900, 17],
  ])('%d×%d → %d varillas', (w, h, rods) => {
    expect(rodCountFor(w, h)).toBe(rods);
  });
});

describe('useRodLayout', () => {
  it('reacciona a rotaciones', () => {
    resize(390, 844);
    const { result } = renderHook(() => useRodLayout());
    expect(result.current).toBe(7);
    act(() => {
      resize(844, 390);
    });
    expect(result.current).toBe(13);
    act(() => {
      resize(1280, 800);
    });
    expect(result.current).toBe(17);
  });
});

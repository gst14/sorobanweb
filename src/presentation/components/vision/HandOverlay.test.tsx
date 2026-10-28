import { render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaultCalibration } from '@/application/vision';
import { HandOverlay, type HandOverlayHandle } from './HandOverlay';

const SCENE = {
  hand: null,
  calibration: defaultCalibration(7),
  mode: 'push',
  media: { width: 960, height: 540 },
} as const;

function fakeContext() {
  return {
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  };
}

function renderOverlay(ctx: ReturnType<typeof fakeContext> | null) {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  const ref = createRef<HandOverlayHandle>();
  const { container } = render(<HandOverlay ref={ref} />);
  const canvas = container.querySelector('canvas');
  if (!canvas || !ref.current) throw new Error('Sin canvas');
  vi.spyOn(canvas, 'clientWidth', 'get').mockReturnValue(390);
  vi.spyOn(canvas, 'clientHeight', 'get').mockReturnValue(220);
  return { canvas, overlay: ref.current };
}

describe('HandOverlay', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('es decorativo para los lectores de pantalla', () => {
    const { canvas } = renderOverlay(fakeContext());
    expect(canvas).toHaveAttribute('aria-hidden', 'true');
  });

  it('ajusta la resolución a la caja y a la densidad de píxeles antes de dibujar', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(2);
    const ctx = fakeContext();
    const { canvas, overlay } = renderOverlay(ctx);
    overlay.draw(SCENE);
    expect(canvas.width).toBe(780);
    expect(canvas.height).toBe(440);
    expect(ctx.setTransform).toHaveBeenCalledWith(2, 0, 0, 2, 0, 0);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 390, 220);
    expect(ctx.strokeRect).toHaveBeenCalledOnce();

    overlay.clear();
    expect(ctx.clearRect).toHaveBeenLastCalledWith(0, 0, 780, 440);
  });

  it('sin densidad informada usa 1', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(0);
    const { canvas, overlay } = renderOverlay(fakeContext());
    overlay.draw(SCENE);
    expect(canvas.width).toBe(390);
  });

  it('sin contexto 2D no hace nada', () => {
    const { overlay } = renderOverlay(null);
    expect(() => {
      overlay.draw(SCENE);
      overlay.clear();
    }).not.toThrow();
  });
});

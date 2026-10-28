import { type Ref, useImperativeHandle, useRef } from 'react';
import { type OverlayScene, drawHandOverlay } from './overlayDrawing';
import './HandOverlay.css';

export interface HandOverlayHandle {
  /** Dibuja un frame. Se llama fuera de React, desde `onFrame`, sin re-renderizar. */
  draw(scene: OverlayScene): void;
  clear(): void;
}

/**
 * Canvas 2D encima del `<video>` de la cámara, del mismo tamaño que su caja. Ajusta la
 * resolución al tamaño en pantalla y a la densidad de píxeles en cada dibujo.
 */
export function HandOverlay({ ref }: { ref?: Ref<HandOverlayHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useImperativeHandle(ref, () => {
    const context = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      return canvas && ctx ? { canvas, ctx } : null;
    };
    return {
      draw(scene) {
        const target = context();
        if (!target) return;
        const { canvas, ctx } = target;
        const box = { width: canvas.clientWidth, height: canvas.clientHeight };
        const dpr = window.devicePixelRatio || 1;
        const width = Math.round(box.width * dpr);
        const height = Math.round(box.height * dpr);
        if (canvas.width !== width) canvas.width = width;
        if (canvas.height !== height) canvas.height = height;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawHandOverlay(ctx, box, scene);
      },
      clear() {
        const target = context();
        target?.ctx.clearRect(0, 0, target.canvas.width, target.canvas.height);
      },
    };
  }, []);

  return <canvas ref={canvasRef} className="hand-overlay" aria-hidden="true" />;
}

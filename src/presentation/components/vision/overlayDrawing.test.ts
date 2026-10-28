import { describe, expect, it } from 'vitest';
import type { Landmark, TrackedHand } from '@/application/ports';
import {
  HAND_CONNECTIONS,
  type OverlayContext,
  type OverlayScene,
  containRect,
  drawHandOverlay,
} from './overlayDrawing';

type Call = readonly [string, ...unknown[]];

/** Contexto que graba cada llamada junto con el color vigente al rellenar o trazar. */
function recordingContext() {
  const calls: Call[] = [];
  const ctx: OverlayContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    clearRect: (...a) => void calls.push(['clearRect', ...a]),
    fillRect: (...a) => void calls.push(['fillRect', ctx.fillStyle, ...a]),
    strokeRect: (...a) => void calls.push(['strokeRect', ...a]),
    beginPath: () => void calls.push(['beginPath']),
    closePath: () => void calls.push(['closePath']),
    moveTo: (...a) => void calls.push(['moveTo', ...a]),
    lineTo: (...a) => void calls.push(['lineTo', ...a]),
    arc: (...a) => void calls.push(['arc', ctx.fillStyle, ...a]),
    fill: () => void calls.push(['fill', ctx.fillStyle]),
    stroke: () => void calls.push(['stroke', ctx.strokeStyle]),
  };
  const of = (name: string) => calls.filter((c) => c[0] === name);
  return { ctx, calls, of };
}

// 7 varillas de 0,1 de ancho: la columna de la izquierda es la varilla 6.
const CAL = { left: 0.1, right: 0.8, beamY: 0.4, beadHeight: 0.05, rodCount: 7 };
const BOX = { width: 1000, height: 500 };
const MEDIA = { width: 1000, height: 500 };

/** Mano con los 21 landmarks en (0,02; 0,9), fuera del recuadro, salvo los que se indiquen. */
function hand(overrides: Readonly<Record<number, Landmark>> = {}): TrackedHand {
  const landmarks = Array.from({ length: 21 }, (_, i) => overrides[i] ?? { x: 0.02, y: 0.9 });
  return { t: 0, landmarks, score: 0.9 };
}

const scene = (patch: Partial<OverlayScene> = {}): OverlayScene => ({
  hand: null,
  calibration: CAL,
  mode: 'push',
  media: MEDIA,
  ...patch,
});

describe('containRect', () => {
  it('centra el video sin recortarlo, con bandas a los costados o arriba y abajo', () => {
    expect(containRect({ width: 400, height: 300 }, { width: 960, height: 540 })).toEqual({
      x: 0,
      y: 37.5,
      width: 400,
      height: 225,
    });
    expect(containRect({ width: 400, height: 600 }, { width: 100, height: 100 })).toEqual({
      x: 0,
      y: 100,
      width: 400,
      height: 400,
    });
    expect(containRect({ width: 800, height: 225 }, { width: 960, height: 540 })).toMatchObject({
      x: 200,
      width: 400,
    });
  });

  it('sin tamaño del video (todavía sin metadata) usa toda la caja', () => {
    expect(containRect(BOX, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, ...BOX });
  });
});

describe('drawHandOverlay', () => {
  it('sin mano limpia y dibuja solo el recuadro, las varillas y la viga', () => {
    const { ctx, calls, of } = recordingContext();
    drawHandOverlay(ctx, BOX, scene());
    expect(calls[0]).toEqual(['clearRect', 0, 0, 1000, 500]);
    // Recuadro: de 2 cuentas arriba de la viga (y 0,3) a 5 abajo (y 0,65).
    const [rect] = of('strokeRect');
    expect(rect?.[1]).toBeCloseTo(100);
    expect(rect?.[2]).toBeCloseTo(150);
    expect(rect?.[3]).toBeCloseTo(700);
    expect(rect?.[4]).toBeCloseTo(175);
    // 7 varillas + la viga.
    expect(of('moveTo')).toHaveLength(8);
    expect(of('fillRect')).toHaveLength(0);
    expect(of('arc')).toHaveLength(0);
  });

  it('dibuja las conexiones, las articulaciones, el pulgar en círculo y el índice en rombo', () => {
    const { ctx, of } = recordingContext();
    const h = hand({ 4: { x: 0.95, y: 0.1 }, 8: { x: 0.05, y: 0.95 } });
    drawHandOverlay(ctx, BOX, scene({ hand: h }));
    expect(of('moveTo')).toHaveLength(8 + HAND_CONNECTIONS.length + 1);
    const arcs = of('arc');
    expect(arcs).toHaveLength(21 + 1);
    expect(arcs.at(-1)?.slice(1, 5)).toEqual(['#3fb950', 950, 50, 8]);
    // El rombo del índice: 4 vértices alrededor de (50, 475).
    expect(of('lineTo').slice(-3)).toEqual([
      ['lineTo', 58, 475],
      ['lineTo', 50, 483],
      ['lineTo', 42, 475],
    ]);
    expect(of('fill').at(-1)).toEqual(['fill', '#58a6ff']);
  });

  it('las coordenadas siguen al video dentro de la caja con bandas', () => {
    const { ctx, of } = recordingContext();
    const h = hand({ 4: { x: 0.5, y: 0.5 } });
    // Caja de 1000×1000 con un video 2:1 → franja de 1000×500 empezando en y = 250.
    drawHandOverlay(ctx, { width: 1000, height: 1000 }, scene({ hand: h }));
    expect(of('arc').at(-1)?.slice(2, 4)).toEqual([500, 500]);
  });

  it('marca la varilla y la sección bajo cada dedo en el modo empuje', () => {
    const { ctx, of } = recordingContext();
    // Pulgar en la varilla 0 (columna 6), en el cielo; índice en la varilla 6, en la tierra.
    const h = hand({ 4: { x: 0.75, y: 0.35 }, 8: { x: 0.15, y: 0.5 } });
    drawHandOverlay(ctx, BOX, scene({ hand: h }));
    const fills = of('fillRect').map(([, color, x, y, w, hgt]) => [
      color,
      Math.round(x as number),
      Math.round(y as number),
      Math.round(w as number),
      Math.round(hgt as number),
    ]);
    expect(fills).toEqual([
      ['rgb(63 185 80 / 0.12)', 700, 150, 100, 175],
      ['rgb(63 185 80 / 0.35)', 700, 150, 100, 50],
      ['rgb(88 166 255 / 0.12)', 100, 150, 100, 175],
      ['rgb(88 166 255 / 0.35)', 100, 200, 100, 125],
    ]);
  });

  it('en el modo puntero solo cuenta el índice', () => {
    const { ctx, of } = recordingContext();
    const h = hand({ 4: { x: 0.75, y: 0.35 }, 8: { x: 0.15, y: 0.5 } });
    drawHandOverlay(ctx, BOX, scene({ hand: h, mode: 'pinch' }));
    expect(of('fillRect').map((c) => c[1])).toEqual([
      'rgb(88 166 255 / 0.12)',
      'rgb(88 166 255 / 0.35)',
    ]);
  });

  it('fuera del recuadro no marca nada; fuera de las secciones marca solo la varilla', () => {
    const outside = recordingContext();
    drawHandOverlay(outside.ctx, BOX, scene({ hand: hand({ 4: { x: 0.05, y: 0.4 } }) }));
    expect(outside.of('fillRect')).toHaveLength(0);

    const below = recordingContext();
    drawHandOverlay(below.ctx, BOX, scene({ hand: hand({ 4: { x: 0.45, y: 0.95 } }) }));
    expect(below.of('fillRect').map((c) => c[1])).toEqual(['rgb(63 185 80 / 0.12)']);
  });

  it('un frame con landmarks de menos no lanza y dibuja lo que hay', () => {
    const { ctx, of } = recordingContext();
    const partial: TrackedHand = { t: 0, score: 0.5, landmarks: [{ x: 0.5, y: 0.5 }] };
    expect(() => {
      drawHandOverlay(ctx, BOX, scene({ hand: partial }));
    }).not.toThrow();
    expect(of('arc')).toHaveLength(1);
    expect(of('fillRect')).toHaveLength(0);
  });

  describe('mientras se calibra', () => {
    it('no dibuja el recuadro y muestra el progreso alrededor del índice', () => {
      const { ctx, of } = recordingContext();
      const h = hand({ 8: { x: 0.3, y: 0.4 } });
      drawHandOverlay(ctx, BOX, scene({ hand: h, capture: { points: [], progress: 0.5 } }));
      expect(of('strokeRect')).toHaveLength(0);
      expect(of('fillRect')).toHaveLength(0);
      // Solo la mano y el rombo: sin viga todavía.
      expect(of('moveTo')).toHaveLength(HAND_CONNECTIONS.length + 1);
      const progress = of('arc').find((c) => c[4] === 16);
      expect(progress?.slice(2, 4)).toEqual([300, 200]);
      expect(progress?.[5]).toBeCloseTo(-Math.PI / 2);
      expect(progress?.[6]).toBeCloseTo(Math.PI / 2);
    });

    it('dibuja la viga provisoria desde el primer extremo hasta el índice', () => {
      const { ctx, of } = recordingContext();
      const h = hand({ 8: { x: 0.6, y: 0.4 } });
      const capture = { points: [{ x: 0.2, y: 0.4 }], progress: 0 };
      drawHandOverlay(ctx, BOX, scene({ hand: h, capture }));
      expect(of('moveTo')[0]).toEqual(['moveTo', 200, 200]);
      expect(of('lineTo')[0]).toEqual(['lineTo', 600, 200]);
      expect(of('arc')[0]).toEqual(['arc', 'rgb(255 255 255 / 0.9)', 200, 200, 6, 0, Math.PI * 2]);
      expect(of('arc').some((c) => c[4] === 16)).toBe(false);
    });

    it('con los dos extremos marcados la viga va de uno al otro, aunque no haya mano', () => {
      const { ctx, of } = recordingContext();
      const capture = {
        points: [
          { x: 0.2, y: 0.4 },
          { x: 0.8, y: 0.5 },
        ],
        progress: 0,
      };
      drawHandOverlay(ctx, BOX, scene({ capture }));
      expect(of('lineTo')).toEqual([['lineTo', 800, 250]]);
      expect(of('arc')).toHaveLength(2);
    });
  });
});

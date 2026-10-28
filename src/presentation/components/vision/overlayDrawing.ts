import type { Calibration, GestureMode, Landmark, TrackedHand } from '@/application/ports';
import { EARTH_TRACK, HEAVEN_TRACK, beadUnits, deckAt, rodAt } from '@/application/vision';
import type { Deck } from '@/domain';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Size {
  readonly x: number;
  readonly y: number;
}

/** Lo que se dibuja en un frame. `media` es el tamaño nativo del video (`videoWidth/Height`). */
export interface OverlayScene {
  readonly hand: TrackedHand | null;
  readonly calibration: Calibration;
  readonly mode: GestureMode;
  readonly media: Size;
}

/** Lo que el dibujo usa de `CanvasRenderingContext2D`; los tests pasan uno que graba. */
export type OverlayContext = Pick<
  CanvasRenderingContext2D,
  | 'clearRect'
  | 'fillRect'
  | 'strokeRect'
  | 'beginPath'
  | 'closePath'
  | 'moveTo'
  | 'lineTo'
  | 'arc'
  | 'fill'
  | 'stroke'
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
>;

type Finger = 'thumb' | 'index';

/** Topología de los 21 landmarks de MediaPipe Hands: pulgar, dedos y palma. */
export const HAND_CONNECTIONS: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17],
]; // prettier-ignore

const TIPS: Readonly<Record<Finger, number>> = { thumb: 4, index: 8 };

/** En empuje mueven cuentas los dos dedos; en puntero, solo el índice apunta. */
const ACTIVE_FINGERS: Readonly<Record<GestureMode, readonly Finger[]>> = {
  push: ['thumb', 'index'],
  pinch: ['index'],
};

// Colores fijos, no del tema: van sobre el video y tienen que leerse en cualquier imagen.
const COLORS = {
  thumb: '#3fb950',
  index: '#58a6ff',
  bones: 'rgb(255 255 255 / 0.85)',
  joints: '#ffffff',
  roi: 'rgb(255 255 255 / 0.55)',
  beam: 'rgb(255 255 255 / 0.9)',
} as const;

const ZONE_FILL: Readonly<Record<Finger, { rod: string; deck: string }>> = {
  thumb: { rod: 'rgb(63 185 80 / 0.12)', deck: 'rgb(63 185 80 / 0.35)' },
  index: { rod: 'rgb(88 166 255 / 0.12)', deck: 'rgb(88 166 255 / 0.35)' },
};

const TIP_RADIUS = 8;
const JOINT_RADIUS = 2.5;

/** Dónde queda el video dentro de su caja con `object-fit: contain` (centrado, sin recortar). */
export function containRect(box: Size, media: Size): Rect {
  if (media.width <= 0 || media.height <= 0) return { x: 0, y: 0, ...box };
  const scale = Math.min(box.width / media.width, box.height / media.height);
  const width = media.width * scale;
  const height = media.height * scale;
  return { x: (box.width - width) / 2, y: (box.height - height) / 2, width, height };
}

/** Rango vertical de una sección, en y normalizada. */
function deckBand(cal: Calibration, deck: Deck): readonly [number, number] {
  return deck === 'heaven'
    ? [cal.beamY - HEAVEN_TRACK * cal.beadHeight, cal.beamY]
    : [cal.beamY, cal.beamY + EARTH_TRACK * cal.beadHeight];
}

/**
 * Dibuja un frame: el recuadro del soroban con sus varillas y la viga, la varilla y la sección
 * bajo cada dedo activo, y la mano (conexiones, pulgar como círculo verde e índice como rombo
 * azul). Las coordenadas ya vienen espejadas, así que el canvas no se espeja.
 */
export function drawHandOverlay(ctx: OverlayContext, box: Size, scene: OverlayScene): void {
  const { hand, calibration: cal } = scene;
  ctx.clearRect(0, 0, box.width, box.height);
  const frame = containRect(box, scene.media);
  const px = (x: number) => frame.x + x * frame.width;
  const py = (y: number) => frame.y + y * frame.height;
  const rodWidth = (cal.right - cal.left) / cal.rodCount;
  const columnLeft = (rod: number) => cal.left + (cal.rodCount - 1 - rod) * rodWidth;
  const [top] = deckBand(cal, 'heaven');
  const [, bottom] = deckBand(cal, 'earth');

  const tips = (hand ? ACTIVE_FINGERS[scene.mode] : []).flatMap((finger) => {
    const tip = hand?.landmarks[TIPS[finger]];
    return tip ? [{ finger, tip }] : [];
  });

  for (const { finger, tip } of tips) {
    const rod = rodAt(cal, tip.x);
    if (rod === null) continue;
    const x = px(columnLeft(rod));
    const w = rodWidth * frame.width;
    ctx.fillStyle = ZONE_FILL[finger].rod;
    ctx.fillRect(x, py(top), w, py(bottom) - py(top));
    const deck = deckAt(beadUnits(cal, tip.y));
    if (deck === null) continue;
    const [from, to] = deckBand(cal, deck);
    ctx.fillStyle = ZONE_FILL[finger].deck;
    ctx.fillRect(x, py(from), w, py(to) - py(from));
  }

  ctx.strokeStyle = COLORS.roi;
  ctx.lineWidth = 1;
  ctx.strokeRect(px(cal.left), py(top), (cal.right - cal.left) * frame.width, py(bottom) - py(top));
  ctx.beginPath();
  for (let column = 0; column < cal.rodCount; column++) {
    const x = px(cal.left + (column + 0.5) * rodWidth);
    ctx.moveTo(x, py(top));
    ctx.lineTo(x, py(bottom));
  }
  ctx.stroke();
  ctx.strokeStyle = COLORS.beam;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px(cal.left), py(cal.beamY));
  ctx.lineTo(px(cal.right), py(cal.beamY));
  ctx.stroke();

  if (!hand) return;
  const point = (p: Landmark) => [px(p.x), py(p.y)] as const;

  ctx.strokeStyle = COLORS.bones;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const from = hand.landmarks[a];
    const to = hand.landmarks[b];
    if (!from || !to) continue;
    ctx.moveTo(...point(from));
    ctx.lineTo(...point(to));
  }
  ctx.stroke();

  ctx.fillStyle = COLORS.joints;
  for (const landmark of hand.landmarks) {
    const [x, y] = point(landmark);
    ctx.beginPath();
    ctx.arc(x, y, JOINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  const thumb = hand.landmarks[TIPS.thumb];
  if (thumb) {
    const [x, y] = point(thumb);
    ctx.fillStyle = COLORS.thumb;
    ctx.beginPath();
    ctx.arc(x, y, TIP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }
  const index = hand.landmarks[TIPS.index];
  if (index) {
    const [x, y] = point(index);
    ctx.fillStyle = COLORS.index;
    ctx.beginPath();
    ctx.moveTo(x, y - TIP_RADIUS);
    ctx.lineTo(x + TIP_RADIUS, y);
    ctx.lineTo(x, y + TIP_RADIUS);
    ctx.lineTo(x - TIP_RADIUS, y);
    ctx.closePath();
    ctx.fill();
  }
}

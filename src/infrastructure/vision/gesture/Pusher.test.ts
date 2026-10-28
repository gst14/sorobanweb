import { describe, expect, it } from 'vitest';
import { type Move, Soroban } from '@/domain';
import { Pusher } from './Pusher';
import { StrokeWindow } from './StrokeWindow';
import { CAL, type TipSample, rodX, stroke, unitsY } from './testing/strokes';

/** Pasa las muestras por el pusher aplicando cada movimiento al soroban. */
function play(pusher: Pusher, samples: readonly TipSample[], start: Soroban) {
  let soroban = start;
  const moves: Move[] = [];
  for (const s of samples) {
    const move = pusher.update(s, s.t, soroban);
    if (move) {
      moves.push(move);
      soroban = soroban.apply(move);
    }
  }
  return { soroban, moves };
}

/** Filtro casi transparente, para probar la lógica de trazos sin el retraso del One Euro. */
const RAW = { filter: { minCutoff: 1e4 } };

describe('Pusher', () => {
  it('subir 3 con el pulgar y bajar 1 con el índice deja 2 (con el filtro por defecto)', () => {
    const thumb = new Pusher('thumb', CAL);
    const index = new Pusher('index', CAL);
    // Varilla 0 en 0: la tierra inactiva tiene centros 1,5 · 2,5 · 3,5 · 4,5.
    const up = play(thumb, stroke(CAL, { rod: 0, from: 3.5, to: 1 }), Soroban.create(7));
    expect(up.moves).toMatchObject([{ rod: 0, deck: 'earth', delta: 3, finger: 'thumb' }]);
    // Ahora la cuenta del slot 2 está activa, centrada en 2,5.
    const down = play(index, stroke(CAL, { rod: 0, from: 2.5, to: 4, t0: 1000 }), up.soroban);
    expect(down.moves).toMatchObject([{ rod: 0, deck: 'earth', delta: -1, finger: 'index' }]);
    expect(down.soroban.toNumber()).toBe(2);
  });

  it('el cielo baja hacia la viga para sumar 5 y sube para restarlo', () => {
    const p = new Pusher('index', CAL, RAW);
    const down = play(p, stroke(CAL, { rod: 1, from: -1.5, to: -0.5 }), Soroban.create(7));
    expect(down.soroban.toNumber()).toBe(50);
    const up = play(p, stroke(CAL, { rod: 1, from: -0.5, to: -1.8, t0: 1000 }), down.soroban);
    expect(up.soroban.toNumber()).toBe(0);
  });

  it('una deriva lenta no emite', () => {
    const p = new Pusher('thumb', CAL);
    const slow = stroke(CAL, { rod: 0, from: 3.5, to: 1, durationMs: 3000 });
    expect(play(p, slow, Soroban.create(7)).moves).toEqual([]);
  });

  it('dos trazos en menos de 120 ms sobre la misma varilla emiten uno', () => {
    const p = new Pusher('index', CAL, RAW);
    const x = rodX(CAL, 0);
    const at = (u: number, t: number) => ({ x, y: unitsY(CAL, u), t });
    // Baja el cielo (t = 40) y enseguida lo sube (t = 80): el segundo cae en el cooldown.
    const samples = [at(-1.5, 0), at(-1.5, 20), at(-1, 40), at(-1.5, 60), at(-2, 80)];
    const { moves } = play(p, samples, Soroban.create(7));
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ deck: 'heaven', delta: 1, at: 40 });
  });

  it('empujar una cuenta que ya está contra la viga no emite', () => {
    const p = new Pusher('thumb', CAL, RAW);
    const four = Soroban.fromNumber(4, 7);
    expect(play(p, stroke(CAL, { rod: 0, from: 1.5, to: 0.2 }), four).moves).toEqual([]);
  });

  it('fuera de las secciones, fuera del ROI o más allá del soroban no emite', () => {
    const p = new Pusher('thumb', CAL, RAW);
    expect(play(p, stroke(CAL, { rod: 0, from: 8, to: 6 }), Soroban.create(7)).moves).toEqual([]);
    const outside = stroke(CAL, { rod: 0, from: 3.5, to: 1 }).map((s) => ({ ...s, x: 0.95 }));
    expect(play(p, outside, Soroban.create(7)).moves).toEqual([]);
    // Calibrado para 7 varillas, pero el soroban tiene 3: la varilla 5 no existe.
    expect(play(p, stroke(CAL, { rod: 5, from: 3.5, to: 1 }), Soroban.create(3)).moves).toEqual([]);
  });

  it('al cambiar de varilla empieza un trazo nuevo', () => {
    const p = new Pusher('thumb', CAL, RAW);
    const s = Soroban.create(7);
    // Quieto en la varilla 1 y el primer frame ya en la 0, más arriba: no cuenta como trazo.
    expect(p.update({ x: rodX(CAL, 1), y: unitsY(CAL, 3.5) }, 0, s)).toBeNull();
    expect(p.update({ x: rodX(CAL, 0), y: unitsY(CAL, 1) }, 30, s)).toBeNull();
  });

  it('reset olvida el trazo y el cooldown', () => {
    const p = new Pusher('index', CAL, RAW);
    const x = rodX(CAL, 0);
    const s = Soroban.create(7);
    p.update({ x, y: unitsY(CAL, -1.5) }, 0, s);
    p.reset();
    expect(p.update({ x, y: unitsY(CAL, -0.5) }, 10, s)).toBeNull();
  });
});

describe('StrokeWindow', () => {
  it('el ancla avanza con la ventana', () => {
    const w = new StrokeWindow(100);
    expect(w.push(0, 0)).toEqual({ u: 0, t: 0 });
    expect(w.push(1, 50)).toEqual({ u: 0, t: 0 });
    expect(w.push(2, 120)).toEqual({ u: 1, t: 50 });
    expect(w.push(3, 500)).toEqual({ u: 3, t: 500 });
  });
});

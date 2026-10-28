import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FakeClock } from '@/application/testing/fakes';
import { type Move, Soroban } from '@/domain';
import { PointerInput, readBeadTarget } from './PointerInput';

const SVG_NS = 'http://www.w3.org/2000/svg';

function buildSvg(rods: number): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  for (let rod = 0; rod < rods; rod++) {
    const heaven = document.createElementNS(SVG_NS, 'rect');
    heaven.setAttribute('data-rod', String(rod));
    heaven.setAttribute('data-deck', 'heaven');
    svg.append(heaven);
    for (let slot = 0; slot < 4; slot++) {
      const bead = document.createElementNS(SVG_NS, 'rect');
      bead.setAttribute('data-rod', String(rod));
      bead.setAttribute('data-deck', 'earth');
      bead.setAttribute('data-slot', String(slot));
      // la altura determina el umbral de arrastre: 40 px × 0,35 = 14 px
      bead.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 40, height: 40 });
      svg.append(bead);
    }
  }
  document.body.append(svg);
  return svg;
}

function bead(svg: Element, rod: number, deck: 'heaven' | 'earth', slot = 0): Element {
  const base = `[data-rod="${String(rod)}"][data-deck="${deck}"]`;
  const selector = deck === 'heaven' ? base : `${base}[data-slot="${String(slot)}"]`;
  const el = svg.querySelector(selector);
  if (!el) throw new Error(`No existe ${selector}`);
  return el;
}

const pointer = (el: Element, type: string, pointerId: number, x: number, y: number) =>
  el.dispatchEvent(new PointerEvent(type, { pointerId, clientX: x, clientY: y, bubbles: true }));

describe('PointerInput', () => {
  let svg: SVGSVGElement;
  let soroban: Soroban;
  let moves: Move[];
  let input: PointerInput;

  beforeEach(() => {
    svg = buildSvg(3);
    soroban = Soroban.create(3);
    moves = [];
    input = new PointerInput({
      element: svg,
      getSoroban: () => soroban,
      clock: new FakeClock(500),
    });
    input.start((m) => {
      moves.push(m);
      soroban = soroban.apply(m);
    });
  });

  afterEach(() => {
    input.stop();
    svg.remove();
  });

  const tap = (el: Element, id = 1) => {
    pointer(el, 'pointerdown', id, 10, 100);
    pointer(el, 'pointerup', id, 12, 102);
  };

  it('tap en la tercera cuenta sube tres; volver a tocarla deja dos', () => {
    tap(bead(svg, 0, 'earth', 2));
    expect(soroban.toNumber()).toBe(3);
    tap(bead(svg, 0, 'earth', 2));
    expect(soroban.toNumber()).toBe(2);
    expect(moves.map((m) => m.delta)).toEqual([3, -1]);
    expect(moves[0]).toMatchObject({ rod: 0, deck: 'earth', finger: 'unknown', at: 500 });
  });

  it('tap en el cielo lo baja y lo sube', () => {
    tap(bead(svg, 1, 'heaven'));
    expect(soroban.toNumber()).toBe(50);
    tap(bead(svg, 1, 'heaven'));
    expect(soroban.toNumber()).toBe(0);
  });

  it('arrastrar la tierra hacia arriba (hacia la viga) suma; hacia abajo resta', () => {
    const el = bead(svg, 0, 'earth', 3);
    pointer(el, 'pointerdown', 1, 0, 100);
    pointer(el, 'pointermove', 1, 0, 90); // menos que el umbral
    expect(moves).toHaveLength(0);
    pointer(el, 'pointermove', 1, 0, 80);
    pointer(el, 'pointermove', 1, 0, 40); // ya disparó: no repite
    pointer(el, 'pointerup', 1, 0, 40);
    expect(soroban.toNumber()).toBe(4);

    const top = bead(svg, 0, 'earth', 0);
    pointer(top, 'pointerdown', 2, 0, 100);
    pointer(top, 'pointermove', 2, 0, 130);
    pointer(top, 'pointerup', 2, 0, 130);
    expect(soroban.toNumber()).toBe(0);
  });

  it('arrastrar el cielo hacia abajo lo baja; en la dirección inválida no hace nada', () => {
    const el = bead(svg, 2, 'heaven');
    pointer(el, 'pointerdown', 1, 0, 100);
    pointer(el, 'pointermove', 1, 0, 80); // alejar algo que ya está arriba
    pointer(el, 'pointerup', 1, 0, 80);
    expect(moves).toHaveLength(0);
    pointer(el, 'pointerdown', 2, 0, 100);
    pointer(el, 'pointermove', 2, 0, 130);
    expect(soroban.toNumber()).toBe(500);
  });

  it('dos punteros simultáneos sobre varillas distintas (pinza)', () => {
    const heaven = bead(svg, 0, 'heaven');
    const earth = bead(svg, 1, 'earth', 1);
    pointer(heaven, 'pointerdown', 1, 0, 100);
    pointer(earth, 'pointerdown', 2, 50, 200);
    pointer(heaven, 'pointermove', 1, 0, 130);
    pointer(earth, 'pointermove', 2, 50, 170);
    pointer(heaven, 'pointerup', 1, 0, 130);
    pointer(earth, 'pointerup', 2, 50, 170);
    expect(soroban.toNumber()).toBe(25);
  });

  it('moverse más que el slop pero menos que el umbral no es tap ni arrastre', () => {
    const el = bead(svg, 0, 'earth', 0);
    pointer(el, 'pointerdown', 1, 0, 100);
    pointer(el, 'pointerup', 1, 11, 100);
    expect(moves).toHaveLength(0);
  });

  it('pointercancel descarta el gesto', () => {
    const el = bead(svg, 0, 'earth', 0);
    pointer(el, 'pointerdown', 1, 0, 100);
    pointer(el, 'pointercancel', 1, 0, 100);
    pointer(el, 'pointerup', 1, 0, 100);
    expect(moves).toHaveLength(0);
  });

  it('ignora toques fuera de las cuentas, varillas inexistentes y eventos que no son de puntero', () => {
    pointer(svg, 'pointerdown', 1, 0, 0);
    pointer(svg, 'pointerup', 1, 0, 0);
    const extra = document.createElementNS(SVG_NS, 'rect');
    extra.setAttribute('data-rod', '9');
    extra.setAttribute('data-deck', 'heaven');
    svg.append(extra);
    tap(extra);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) {
      svg.dispatchEvent(new Event(type, { bubbles: true }));
    }
    pointer(svg, 'pointermove', 7, 0, 0);
    expect(moves).toHaveLength(0);
  });

  it('stop en medio de un gesto evita que se emita', () => {
    const el = bead(svg, 2, 'heaven');
    pointer(el, 'pointerdown', 1, 0, 100);
    input.stop();
    pointer(el, 'pointerup', 1, 0, 100);
    expect(moves).toHaveLength(0);
  });

  it('si entre el down y el up el soroban pasó a tener menos varillas, no emite', () => {
    const wideSvg = buildSvg(5);
    let current = Soroban.create(5);
    const emitted: Move[] = [];
    const wide = new PointerInput({
      element: wideSvg,
      getSoroban: () => current,
      clock: new FakeClock(),
    });
    wide.start((m) => emitted.push(m));
    const el = bead(wideSvg, 4, 'heaven');
    pointer(el, 'pointerdown', 1, 0, 100);
    current = Soroban.create(3); // rotación a vertical
    pointer(el, 'pointerup', 1, 0, 100);
    expect(emitted).toHaveLength(0);
    wide.stop();
    wideSvg.remove();
  });
});

describe('readBeadTarget', () => {
  const el = (attrs: Record<string, string>) => {
    const e = document.createElementNS(SVG_NS, 'rect');
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  it('lee rod, deck y slot', () => {
    const e = el({ 'data-rod': '2', 'data-deck': 'earth', 'data-slot': '3' });
    expect(readBeadTarget(e)).toEqual({ rod: 2, deck: 'earth', slot: 3, element: e });
    expect(readBeadTarget(el({ 'data-rod': '0', 'data-deck': 'heaven' }))?.slot).toBe(0);
  });

  it.each([
    { 'data-rod': '-1', 'data-deck': 'earth' },
    { 'data-rod': 'x', 'data-deck': 'earth' },
    { 'data-rod': '1', 'data-deck': 'sky' },
    { 'data-rod': '1', 'data-deck': 'earth', 'data-slot': '4' },
  ])('rechaza %j', (attrs) => {
    expect(readBeadTarget(el(attrs))).toBeNull();
  });

  it('null si no hay elemento o no está dentro de una cuenta', () => {
    expect(readBeadTarget(null)).toBeNull();
    expect(readBeadTarget(document.createElementNS(SVG_NS, 'g'))).toBeNull();
  });
});

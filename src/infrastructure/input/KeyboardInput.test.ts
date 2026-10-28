import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeClock } from '@/application/testing/fakes';
import { type Move, Soroban } from '@/domain';
import { KeyboardInput } from './KeyboardInput';

describe('KeyboardInput', () => {
  let target: HTMLDivElement;
  let soroban: Soroban;
  let moves: Move[];
  let input: KeyboardInput;
  const onSelect = vi.fn<(rod: number) => void>();
  const onClear = vi.fn<() => void>();

  const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, cancelable: true, ...init });
    target.dispatchEvent(event);
    return event;
  };

  beforeEach(() => {
    target = document.createElement('div');
    soroban = Soroban.create(3);
    moves = [];
    onSelect.mockClear();
    onClear.mockClear();
    input = new KeyboardInput({
      element: target,
      getSoroban: () => soroban,
      clock: new FakeClock(42),
      onSelect,
      onClear,
    });
    input.start((m) => {
      moves.push(m);
      soroban = soroban.apply(m);
    });
  });

  afterEach(() => {
    input.stop();
  });

  it('se puede resolver 3 + 4 = 7 solo con teclado', () => {
    for (let i = 0; i < 3; i++) press('ArrowUp');
    // 3 + 4 = +5 −1
    press('ArrowDown', { shiftKey: true });
    press('ArrowDown');
    expect(soroban.toNumber()).toBe(7);
    expect(moves[0]).toMatchObject({ rod: 0, deck: 'earth', delta: 1, at: 42 });
  });

  it('←/→ eligen la varilla, con límites, y avisan la selección', () => {
    press('ArrowLeft');
    press('ArrowLeft');
    press('ArrowLeft');
    expect(input.selectedRod).toBe(2);
    press('ArrowUp');
    expect(soroban.toNumber()).toBe(100);
    press('ArrowRight');
    press('ArrowRight');
    press('ArrowRight');
    expect(input.selectedRod).toBe(0);
    expect(onSelect).toHaveBeenLastCalledWith(0);
  });

  it('Shift+↑ sube el cielo', () => {
    soroban = Soroban.fromNumber(5, 3);
    press('ArrowUp', { shiftKey: true });
    expect(soroban.toNumber()).toBe(0);
  });

  it('los movimientos imposibles no se emiten pero la tecla se consume', () => {
    const event = press('ArrowDown');
    expect(moves).toHaveLength(0);
    expect(event.defaultPrevented).toBe(true);
  });

  it('Esc borra; otras teclas y modificadores se ignoran', () => {
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(press('a').defaultPrevented).toBe(false);
    expect(press('ArrowUp', { ctrlKey: true }).defaultPrevented).toBe(false);
    target.dispatchEvent(new Event('keydown'));
    expect(moves).toHaveLength(0);
  });

  it('si el soroban se achica, la selección se ajusta', () => {
    const wide = new KeyboardInput({
      element: target,
      getSoroban: () => soroban,
      clock: new FakeClock(),
    });
    input.stop();
    const emitted: Move[] = [];
    wide.start((m) => emitted.push(m));
    soroban = Soroban.create(5);
    for (let i = 0; i < 4; i++) press('ArrowLeft');
    soroban = Soroban.create(3);
    press('ArrowUp');
    expect(emitted[0]?.rod).toBe(2);
    wide.stop();
    press('ArrowUp');
    expect(emitted).toHaveLength(1);
  });
});

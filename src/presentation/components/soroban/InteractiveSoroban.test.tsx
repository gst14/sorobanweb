import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { createTestServices } from '@/app/testing/testServices';
import { type Move, Soroban } from '@/domain';
import { ServicesProvider } from '../../ServicesProvider';
import { InteractiveSoroban } from './InteractiveSoroban';

function Harness({ readOnly = false, onClear }: { readOnly?: boolean; onClear?: () => void }) {
  const [soroban, setSoroban] = useState(() => Soroban.create(3));
  return (
    <>
      <output data-testid="value">{soroban.toNumber()}</output>
      <InteractiveSoroban
        soroban={soroban}
        onMove={(m: Move) => {
          setSoroban((s) => s.apply(m));
        }}
        readOnly={readOnly}
        {...(onClear ? { onClear } : {})}
      />
    </>
  );
}

const renderHarness = (props: Parameters<typeof Harness>[0] = {}) =>
  render(
    <ServicesProvider services={createTestServices()}>
      <Harness {...props} />
    </ServicesProvider>,
  );

const tap = (el: Element) => {
  fireEvent(el, new PointerEvent('pointerdown', { pointerId: 1, clientY: 100, bubbles: true }));
  fireEvent(el, new PointerEvent('pointerup', { pointerId: 1, clientY: 100, bubbles: true }));
};

describe('<InteractiveSoroban/>', () => {
  it('el caso de la reseña: subir 3 y bajar 1 deja 2', () => {
    const { container, getByTestId } = renderHarness();
    const third = container.querySelector('[data-rod="0"][data-deck="earth"][data-slot="2"]');
    if (!third) throw new Error('falta la cuenta');
    act(() => {
      tap(third);
    });
    expect(getByTestId('value')).toHaveTextContent('3');
    act(() => {
      tap(third);
    });
    expect(getByTestId('value')).toHaveTextContent('2');
  });

  it('teclado: seleccionar varilla, mover cuentas y Esc', () => {
    const onClear = vi.fn();
    const { container, getByTestId } = renderHarness({ onClear });
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('falta el svg');
    fireEvent.keyDown(svg, { key: 'ArrowLeft' });
    expect(container.querySelectorAll('.rod')[1]).toHaveClass('rod--selected');
    fireEvent.keyDown(svg, { key: 'ArrowDown', shiftKey: true });
    expect(getByTestId('value')).toHaveTextContent('50');
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(onClear).toHaveBeenCalled();
  });

  it('readOnly no responde a toques ni teclas', () => {
    const { container, getByTestId } = renderHarness({ readOnly: true });
    const heaven = container.querySelector('[data-rod="0"][data-deck="heaven"]');
    const svg = container.querySelector('svg');
    if (!heaven || !svg) throw new Error('faltan elementos');
    tap(heaven);
    fireEvent.keyDown(svg, { key: 'ArrowUp' });
    expect(getByTestId('value')).toHaveTextContent('0');
  });
});

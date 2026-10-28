import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Soroban } from '@/domain';
import { SorobanSvg } from './SorobanSvg';

describe('<SorobanSvg/>', () => {
  it('etiqueta cada varilla con su valor (307 en 7 varillas)', () => {
    render(<SorobanSvg soroban={Soroban.fromNumber(307, 7)} />);
    expect(screen.getByRole('img', { name: 'Varilla 1: 7' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Varilla 2: 0' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Varilla 3: 3' })).toBeInTheDocument();
    expect(screen.getAllByRole('img')).toHaveLength(7);
  });

  it('renderiza 1 cuenta de cielo y 4 de tierra por varilla con data-* para la entrada', () => {
    const { container } = render(<SorobanSvg soroban={Soroban.create(13)} />);
    expect(container.querySelectorAll('[data-deck="heaven"]')).toHaveLength(13);
    expect(container.querySelectorAll('[data-deck="earth"]')).toHaveLength(52);
    expect(
      container.querySelector('[data-rod="12"][data-deck="earth"][data-slot="3"]'),
    ).not.toBeNull();
  });

  it('marca como activas las cuentas que tocan la viga', () => {
    const { container } = render(<SorobanSvg soroban={Soroban.fromNumber(7, 3)} />);
    const active = container.querySelectorAll('[data-rod="0"].bead--active');
    // 7 = cielo + 2 de tierra
    expect(active).toHaveLength(3);
    expect(container.querySelector('[data-rod="0"][data-deck="heaven"]')).toHaveClass(
      'bead--active',
    );
  });

  it('con showValue anuncia el valor', () => {
    render(<SorobanSvg soroban={Soroban.fromNumber(42, 7)} showValue />);
    expect(screen.getByRole('group', { name: 'Soroban, valor 42' })).toBeInTheDocument();
    expect(screen.getByText('42')).toHaveAttribute('aria-live', 'polite');
  });

  it('resalta la varilla de unidades y la seleccionada; readOnly no es enfocable', () => {
    const { container } = render(
      <SorobanSvg soroban={Soroban.create(7)} selectedRod={2} readOnly />,
    );
    const rods = container.querySelectorAll('.rod');
    expect(rods[0]).toHaveClass('rod--unit');
    expect(rods[2]).toHaveClass('rod--selected');
    expect(screen.getByRole('group', { name: 'Soroban' })).toHaveAttribute('tabindex', '-1');
    expect(container.querySelector('svg')).toHaveClass('soroban--readonly');
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NumericKeypad } from './NumericKeypad';

function Harness({ onSubmit, disabled = false }: { onSubmit: () => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  return (
    <NumericKeypad
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      maxLength={3}
      disabled={disabled}
    />
  );
}

describe('<NumericKeypad/>', () => {
  it('botones en pantalla: dígitos, borrar y OK', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    expect(screen.getByRole('button', { name: 'OK' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '4' }));
    fireEvent.click(screen.getByRole('button', { name: '0' }));
    expect(screen.getByLabelText('Tu respuesta')).toHaveTextContent('40');
    fireEvent.click(screen.getByRole('button', { name: 'Borrar dígito' }));
    expect(screen.getByLabelText('Tu respuesta')).toHaveTextContent('4');
    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('teclado físico, con límite de cifras', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSubmit).not.toHaveBeenCalled();
    for (const key of ['1', '2', '3', '4']) fireEvent.keyDown(window, { key });
    expect(screen.getByLabelText('Tu respuesta')).toHaveTextContent('123');
    fireEvent.click(screen.getByRole('button', { name: '9' }));
    expect(screen.getByLabelText('Tu respuesta')).toHaveTextContent('123');
    fireEvent.keyDown(window, { key: 'Backspace' });
    fireEvent.keyDown(window, { key: 'x' });
    fireEvent.keyDown(window, { key: '5', ctrlKey: true });
    expect(screen.getByLabelText('Tu respuesta')).toHaveTextContent('12');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('deshabilitado ignora todo', () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} disabled />);
    fireEvent.keyDown(window, { key: '7' });
    expect(screen.getByRole('button', { name: '7' })).toBeDisabled();
    expect(screen.getByLabelText('Tu respuesta').textContent.trim()).toBe('');
  });
});

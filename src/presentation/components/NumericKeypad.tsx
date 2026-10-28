import { useEffect, useRef } from 'react';
import './NumericKeypad.css';

export interface NumericKeypadProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: () => void;
  readonly maxLength?: number;
  readonly disabled?: boolean;
}

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3'] as const;

/** Teclado numérico en pantalla (evita que el teclado del sistema tape el soroban). */
export function NumericKeypad({
  value,
  onChange,
  onSubmit,
  maxLength = 4,
  disabled = false,
}: NumericKeypadProps) {
  const latest = useRef({ value, onChange, onSubmit, maxLength, disabled });
  useEffect(() => {
    latest.current = { value, onChange, onSubmit, maxLength, disabled };
  });

  // Teclado físico: dígitos, Backspace y Enter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = latest.current;
      if (s.disabled || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^\d$/.test(e.key)) {
        if (s.value.length < s.maxLength) s.onChange(s.value + e.key);
      } else if (e.key === 'Backspace') {
        s.onChange(s.value.slice(0, -1));
      } else if (e.key === 'Enter') {
        if (s.value !== '') s.onSubmit();
      } else {
        return;
      }
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const press = (digit: string) => {
    if (value.length < maxLength) onChange(value + digit);
  };

  return (
    <div className="keypad">
      <output className="keypad__display" aria-live="polite" aria-label="Tu respuesta">
        {value === '' ? ' ' : value}
      </output>
      <div className="keypad__grid">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            onClick={() => {
              press(k);
            }}
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled || value === ''}
          onClick={() => {
            onChange(value.slice(0, -1));
          }}
          aria-label="Borrar dígito"
        >
          ⌫
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            press('0');
          }}
        >
          0
        </button>
        <button
          type="button"
          className="keypad__ok"
          disabled={disabled || value === ''}
          onClick={onSubmit}
        >
          OK
        </button>
      </div>
    </div>
  );
}

import type { InputMode } from '../stores/settingsStore';
import './InputModeSelector.css';

const LABELS: Readonly<Record<InputMode, string>> = {
  touch: 'Táctil',
  push: 'Empuje',
  pinch: 'Puntero',
};

const HINTS: Readonly<Record<InputMode, string>> = {
  touch: 'Con el dedo en la pantalla',
  push: 'Empujá las cuentas en el aire',
  pinch: 'Pellizcá una cuenta y arrastrala',
};

const ALL: readonly InputMode[] = ['touch', 'push', 'pinch'];

export interface InputModeSelectorProps {
  readonly value: InputMode;
  readonly onChange: (mode: InputMode) => void;
  readonly legend: string;
  /** Qué modos ofrecer; por defecto, los tres. */
  readonly modes?: readonly InputMode[];
}

/** Selector de cómo se mueven las cuentas: táctil, empuje o puntero con pinch. */
export function InputModeSelector({
  value,
  onChange,
  legend,
  modes = ALL,
}: InputModeSelectorProps) {
  return (
    <fieldset className="input-mode">
      <legend>{legend}</legend>
      <div className="input-mode__options">
        {modes.map((mode) => (
          <label key={mode} title={HINTS[mode]}>
            <input
              type="radio"
              name={legend}
              value={mode}
              checked={value === mode}
              onChange={() => {
                onChange(mode);
              }}
            />
            <span>{LABELS[mode]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

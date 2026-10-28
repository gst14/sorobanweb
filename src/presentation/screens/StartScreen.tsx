import { useState } from 'react';
import { useServices } from '../services';

/** "Empezar" desbloquea el audio: iOS solo lo permite dentro de un gesto del usuario. */
export function StartScreen({ onStart }: { onStart: () => void }) {
  const { audio } = useServices();
  const [starting, setStarting] = useState(false);

  const start = () => {
    setStarting(true);
    // unlock() se invoca sincrónicamente dentro del gesto; no se espera para navegar.
    void audio.unlock().finally(() => {
      setStarting(false);
    });
    onStart();
  };

  return (
    <main className="screen screen--start">
      <h1>Soroban Trainer</h1>
      <p className="muted">Cálculo mental con el ábaco japonés, regla por regla.</p>
      <button type="button" className="primary" onClick={start} disabled={starting}>
        Empezar
      </button>
    </main>
  );
}

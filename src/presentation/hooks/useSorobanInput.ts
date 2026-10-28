import { type RefObject, useEffect, useRef, useState } from 'react';
import type { Move, Soroban } from '@/domain';
import { useServices } from '../services';

export interface SorobanInputOptions {
  readonly enabled: boolean;
  readonly soroban: Soroban;
  readonly onMove: (move: Move) => void;
  readonly onClear?: () => void;
}

/**
 * Conecta las entradas táctil y de teclado al <svg> del soroban. Las entradas leen siempre el
 * soroban y los callbacks más recientes (vía refs), así no se re-suscriben en cada render.
 * Devuelve la varilla seleccionada con el teclado.
 */
export function useSorobanInput(
  svgRef: RefObject<SVGSVGElement | null>,
  { enabled, soroban, onMove, onClear }: SorobanInputOptions,
): number | null {
  const { inputs } = useServices();
  const [selectedRod, setSelectedRod] = useState<number | null>(null);
  const latest = useRef({ soroban, onMove, onClear });

  useEffect(() => {
    latest.current = { soroban, onMove, onClear };
  });

  useEffect(() => {
    const svg = svgRef.current;
    if (!enabled || !svg) return;
    const getSoroban = () => latest.current.soroban;
    const emit = (move: Move) => {
      latest.current.onMove(move);
    };
    const pointer = inputs.pointer(svg, getSoroban);
    const keyboard = inputs.keyboard(svg, getSoroban, {
      onSelect: setSelectedRod,
      onClear: () => latest.current.onClear?.(),
    });
    pointer.start(emit);
    keyboard.start(emit);
    return () => {
      pointer.stop();
      keyboard.stop();
    };
  }, [enabled, inputs, svgRef]);

  return enabled ? selectedRod : null;
}

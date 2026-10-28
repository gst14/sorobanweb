import { useRef } from 'react';
import type { Move, Soroban } from '@/domain';
import { useSorobanInput } from '../../hooks/useSorobanInput';
import { SorobanSvg } from './SorobanSvg';

export interface InteractiveSorobanProps {
  readonly soroban: Soroban;
  readonly onMove: (move: Move) => void;
  readonly onClear?: () => void;
  readonly readOnly?: boolean;
  readonly showValue?: boolean;
}

/** Soroban que se opera con toques, arrastres o teclado. */
export function InteractiveSoroban({
  soroban,
  onMove,
  onClear,
  readOnly = false,
  showValue = false,
}: InteractiveSorobanProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const selectedRod = useSorobanInput(svgRef, {
    enabled: !readOnly,
    soroban,
    onMove,
    ...(onClear ? { onClear } : {}),
  });
  return (
    <SorobanSvg
      ref={svgRef}
      soroban={soroban}
      selectedRod={selectedRod}
      readOnly={readOnly}
      showValue={showValue}
    />
  );
}

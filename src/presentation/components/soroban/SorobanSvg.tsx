import type { Ref } from 'react';
import { EARTH_SLOTS, type Soroban } from '@/domain';
import { type Box, computeLayout } from './geometry';
import './SorobanSvg.css';

export interface SorobanSvgProps {
  readonly soroban: Soroban;
  /** Varilla resaltada por el teclado. */
  readonly selectedRod?: number | null;
  readonly readOnly?: boolean;
  /** Anuncia y muestra el valor numérico. */
  readonly showValue?: boolean;
  readonly ref?: Ref<SVGSVGElement>;
}

/** Silueta bicónica de la cuenta, centrada en (0, 0). */
function beadPath(w: number, h: number): string {
  const x = w / 2;
  const y = h / 2;
  const shoulder = w * 0.3;
  return `M ${String(-x)} 0 L ${String(-shoulder)} ${String(-y)} L ${String(shoulder)} ${String(-y)} L ${String(x)} 0 L ${String(shoulder)} ${String(y)} L ${String(-shoulder)} ${String(y)} Z`;
}

interface BeadProps {
  readonly cell: Box;
  readonly rod: number;
  readonly deck: 'heaven' | 'earth';
  readonly slot?: number;
  readonly active: boolean;
  readonly path: string;
}

function Bead({ cell, rod, deck, slot, active, path }: BeadProps) {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  return (
    <g
      className={`bead bead--${deck}${active ? ' bead--active' : ''}`}
      data-rod={rod}
      data-deck={deck}
      data-slot={slot}
      style={{ transform: `translate(${String(cx)}px, ${String(cy)}px)` }}
    >
      <rect
        className="bead__hit"
        x={-cell.width / 2}
        y={-cell.height / 2}
        width={cell.width}
        height={cell.height}
      />
      <path className="bead__body" d={path} />
    </g>
  );
}

export function SorobanSvg({
  soroban,
  selectedRod = null,
  readOnly = false,
  showValue = false,
  ref,
}: SorobanSvgProps) {
  const layout = computeLayout(soroban.rodCount, soroban.unitRod);
  const path = beadPath(layout.beadWidth, layout.beadHeight);
  const rods = soroban.rods.map((rod, i) => ({ rod, i }));
  const label = showValue ? `Soroban, valor ${String(soroban.toNumber())}` : 'Soroban';

  return (
    <>
      <svg
        ref={ref}
        className={`soroban${readOnly ? ' soroban--readonly' : ''}`}
        viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
        role="group"
        aria-label={label}
        tabIndex={readOnly ? -1 : 0}
      >
        <rect
          className="soroban__frame"
          x={4}
          y={4}
          width={layout.width - 8}
          height={layout.height - 8}
          rx={14}
        />
        {rods.map(({ rod, i }) => {
          const x = layout.rodX(i);
          const unit = i === soroban.unitRod;
          const selected = i === selectedRod;
          return (
            <g
              key={i}
              className={`rod${unit ? ' rod--unit' : ''}${selected ? ' rod--selected' : ''}`}
              role="img"
              aria-label={`Varilla ${String(i + 1)}: ${String(rod.value)}`}
            >
              <rect
                className="rod__column"
                x={x - layout.pitchX / 2}
                y={0}
                width={layout.pitchX}
                height={layout.height}
              />
              <line className="rod__line" x1={x} x2={x} y1={14} y2={layout.height - 14} />
              <Bead
                cell={layout.heavenCell(i, rod.heaven)}
                rod={i}
                deck="heaven"
                active={rod.heaven}
                path={path}
              />
              {EARTH_SLOTS.map((slot) => (
                <Bead
                  key={slot}
                  cell={layout.earthCell(i, slot, slot < rod.earth)}
                  rod={i}
                  deck="earth"
                  slot={slot}
                  active={slot < rod.earth}
                  path={path}
                />
              ))}
            </g>
          );
        })}
        <rect className="soroban__beam" {...layout.beam} rx={4} />
        {layout.unitDots.map((i) => (
          <circle
            key={i}
            className={`soroban__dot${i === soroban.unitRod ? ' soroban__dot--unit' : ''}`}
            cx={layout.rodX(i)}
            cy={layout.beam.y + layout.beam.height / 2}
            r={5}
          />
        ))}
      </svg>
      {showValue && (
        <p className="visually-hidden" aria-live="polite">
          {soroban.toNumber()}
        </p>
      )}
    </>
  );
}

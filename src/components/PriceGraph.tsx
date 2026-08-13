import type { CSSProperties } from 'react';
import styles from './PriceGraph.module.css';

interface PriceGraphProps {
  points: number[];
  /** Describes the graph for anyone who can't see it. */
  label: string;
  /** Change this to redraw the line. */
  drawKey?: string;
}

const VIEW_W = 1000;
const VIEW_H = 260;
/** Room for the stroke and for the line to breathe at the extremes. */
const PAD_Y = 10;

/**
 * A single price line. No axes, no grid, no fill — the shape carries the
 * information, and anything else would compete with it.
 */
export function PriceGraph({ points, label, drawKey }: PriceGraphProps) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;

  const x = (i: number) => (i / Math.max(1, points.length - 1)) * VIEW_W;
  const y = (value: number) =>
    VIEW_H - PAD_Y - ((value - min) / span) * (VIEW_H - PAD_Y * 2);

  const path = points.map((value, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(value).toFixed(2)}`).join(' ');
  const rising = points[points.length - 1] >= points[0];
  const baselineY = y(points[0]).toFixed(2);

  return (
    <svg
      className={styles.graph}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      style={{ '--graph-stroke': rising ? 'var(--accent)' : 'var(--negative)' } as CSSProperties}
    >
      {/* Remounting on drawKey replays the draw. */}
      <g key={drawKey} className={styles.reveal}>
        <line className={styles.baseline} x1="0" x2={VIEW_W} y1={baselineY} y2={baselineY} />
        <path className={styles.line} d={path} />
      </g>
    </svg>
  );
}

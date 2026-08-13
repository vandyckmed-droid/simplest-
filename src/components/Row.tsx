import type { ReactNode } from 'react';
import type { Direction } from '../format';
import styles from './Row.module.css';

interface RowProps {
  /** Optional leading column, e.g. a rank number. */
  lead?: string;
  /** Optional mark between the lead and the text, e.g. a logo. */
  media?: ReactNode;
  primary: string;
  secondary?: string;
  value: string;
  meta?: string;
  /** Tints the meta line green or red. Omit to leave it neutral. */
  metaDirection?: Direction;
  /** Optional control pinned to the right edge, e.g. select. */
  trailing?: ReactNode;
  /** Whole-row tap. Gives the row a press state when provided. */
  onActivate?: () => void;
}

/** One list row. Both screens use it so their rhythm stays identical. */
export function Row({
  lead,
  media,
  primary,
  secondary,
  value,
  meta,
  metaDirection,
  trailing,
  onActivate,
}: RowProps) {
  return (
    <li
      className={onActivate ? `${styles.row} ${styles.pressable}` : styles.row}
      onClick={onActivate}
    >
      <div className={styles.inner}>
        {lead !== undefined && <div className={`${styles.lead} tnum`}>{lead}</div>}
        {media}
        <div className={styles.main}>
          <div className={styles.primary}>{primary}</div>
          {secondary && <div className={styles.secondary}>{secondary}</div>}
        </div>
        <div className={styles.side}>
          <div className={`${styles.value} tnum`}>{value}</div>
          {meta && (
            <div className={`${styles.meta} tnum`} data-direction={metaDirection}>
              {meta}
            </div>
          )}
        </div>
        {trailing}
      </div>
    </li>
  );
}

import type { Direction } from '../format';
import styles from './Row.module.css';

interface RowProps {
  /** Optional leading column, e.g. a rank number. */
  lead?: string;
  primary: string;
  secondary: string;
  value: string;
  meta: string;
  /** Tints the meta line green or red. Omit to leave it neutral. */
  metaDirection?: Direction;
}

/** One list row. Both screens use it so their rhythm stays identical. */
export function Row({ lead, primary, secondary, value, meta, metaDirection }: RowProps) {
  return (
    <li className={styles.row}>
      <div className={styles.inner}>
        {lead !== undefined && <div className={`${styles.lead} tnum`}>{lead}</div>}
        <div className={styles.main}>
          <div className={styles.primary}>{primary}</div>
          <div className={styles.secondary}>{secondary}</div>
        </div>
        <div className={styles.side}>
          <div className={`${styles.value} tnum`}>{value}</div>
          <div className={`${styles.meta} tnum`} data-direction={metaDirection}>
            {meta}
          </div>
        </div>
      </div>
    </li>
  );
}

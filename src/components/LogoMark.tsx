import styles from './LogoMark.module.css';

/**
 * Stands in for a real company logo. Deliberately uniform and neutral —
 * ten coloured discs would compete with the ranking for attention. Swapping
 * in real marks later is a change to this component alone.
 */
export function LogoMark({ symbol }: { symbol: string }) {
  return (
    <div className={styles.mark} aria-hidden="true">
      {symbol.slice(0, 1)}
    </div>
  );
}

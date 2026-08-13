import styles from './LogoMark.module.css';

/**
 * Real company marks, downloaded at build time into `src/assets/logos` and
 * bundled — no request leaves the device at runtime. Symbols without a
 * reliable mark fall back to a neutral monogram.
 */
const LOGOS = import.meta.glob('../assets/logos/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

function logoUrl(symbol: string): string | undefined {
  return LOGOS[`../assets/logos/${symbol}.png`];
}

interface LogoMarkProps {
  symbol: string;
  /** Company name, used only when the mark needs describing. */
  name?: string;
}

export function LogoMark({ symbol, name }: LogoMarkProps) {
  const url = logoUrl(symbol);

  if (!url) {
    return (
      <div className={styles.mark} aria-hidden="true">
        {symbol.slice(0, 1)}
      </div>
    );
  }

  return (
    <img
      className={styles.mark}
      src={url}
      alt=""
      aria-hidden="true"
      width={36}
      height={36}
      loading="lazy"
      decoding="async"
      title={name}
    />
  );
}

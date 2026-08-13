import type { ReactNode } from 'react';
import { MoonIcon, SunIcon } from './Icons';
import type { Scheme } from '../useTheme';
import styles from './Screen.module.css';

interface ScreenProps {
  title: string;
  subtitle?: string;
  scheme: Scheme;
  onToggleScheme: () => void;
  children: ReactNode;
}

/** The common frame every screen sits in: safe areas, title block, scroll. */
export function Screen({
  title,
  subtitle,
  scheme,
  onToggleScheme,
  children,
}: ScreenProps) {
  return (
    <main className={styles.screen}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>{title}</h1>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <button
          type="button"
          className={styles.themeButton}
          onClick={onToggleScheme}
          aria-label={scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {scheme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </header>
      {children}
    </main>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className={styles.sectionLabel}>{children}</h2>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className={styles.list}>{children}</ul>;
}

import { useCallback, useEffect, useState } from 'react';

type ThemeChoice = 'system' | 'light' | 'dark';
export type Scheme = 'light' | 'dark';

const STORAGE_KEY = 'stock-app.theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function readStoredChoice(): ThemeChoice {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

function readSystemScheme(): Scheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

/**
 * Follows the system scheme until the user picks one, then remembers the
 * pick. The stylesheet handles the system case on its own, so the
 * `data-theme` attribute is only written for an explicit choice.
 */
export function useTheme(): { scheme: Scheme; toggle: () => void } {
  const [choice, setChoice] = useState<ThemeChoice>(readStoredChoice);
  const [systemScheme, setSystemScheme] = useState<Scheme>(readSystemScheme);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystemScheme(media.matches ? 'dark' : 'light');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const scheme: Scheme = choice === 'system' ? systemScheme : choice;

  useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') {
      root.removeAttribute('data-theme');
      localStorage.removeItem(STORAGE_KEY);
    } else {
      root.setAttribute('data-theme', choice);
      localStorage.setItem(STORAGE_KEY, choice);
    }
  }, [choice]);

  useEffect(() => {
    // Keep the iOS status bar tint in step with the resolved scheme.
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.content = scheme === 'dark' ? '#000000' : '#ffffff';
        meta.removeAttribute('media');
      });
  }, [scheme]);

  const toggle = useCallback(() => {
    setChoice(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme]);

  return { scheme, toggle };
}

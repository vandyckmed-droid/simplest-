// Design tokens and theming.
//
// One palette shape, two values. Screens only ever read from `t` (the resolved
// theme), so a visual redesign happens here and nowhere else.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, Platform } from 'react-native';
import { loadSetting, saveSetting } from './store';

const shared = {
  // A restrained type scale. Numbers are large; labels are small and quiet.
  font: {
    display: 34,
    title: 26,
    heading: 20,
    body: 16,
    label: 13,
    micro: 11,
  },
  weight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  radius: { sm: 8, md: 14, lg: 20, pill: 999 },
  space: (n) => n * 4,
  // Tabular figures keep columns of prices from jittering as digits change.
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
};

const light = {
  ...shared,
  name: 'light',
  bg: '#FFFFFF',
  bgElevated: '#FFFFFF',
  surface: '#F5F6F8',
  surfaceAlt: '#EDEFF3',
  border: '#E3E6EB',
  borderStrong: '#CFD4DC',
  text: '#0A0D14',
  textMuted: '#5D6675',
  textFaint: '#8B93A1',
  accent: '#2563EB',
  accentSoft: '#E5EDFD',
  up: '#0E9F6E',
  upSoft: '#E3F6EE',
  down: '#E02D3C',
  downSoft: '#FDE8EA',
  warn: '#B54708',
  warnSoft: '#FEF0C7',
  chartGrid: '#EDEFF3',
  shadow: 'rgba(10, 13, 20, 0.10)',
  scrim: 'rgba(10, 13, 20, 0.35)',
};

const dark = {
  ...shared,
  name: 'dark',
  bg: '#0A0D14',
  bgElevated: '#11151E',
  surface: '#141924',
  surfaceAlt: '#1C222E',
  border: '#232A38',
  borderStrong: '#323B4C',
  text: '#F4F6FA',
  textMuted: '#98A2B3',
  textFaint: '#6B7585',
  accent: '#5B8DEF',
  accentSoft: '#17233B',
  up: '#2FC08B',
  upSoft: '#10281F',
  down: '#FF5A6A',
  downSoft: '#2A1418',
  warn: '#F5A524',
  warnSoft: '#2A2011',
  chartGrid: '#1C222E',
  shadow: 'rgba(0, 0, 0, 0.5)',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

export const THEMES = { light, dark };

const ThemeContext = createContext({ t: dark, mode: 'system', setMode: () => {} });

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('system');
  const [systemScheme, setSystemScheme] = useState(Appearance.getColorScheme() || 'light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSetting('themeMode', 'system').then((m) => {
      if (alive) {
        setModeState(m);
        setReady(true);
      }
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => {
      alive = false;
      if (sub && sub.remove) sub.remove();
    };
  }, []);

  const setMode = (m) => {
    setModeState(m);
    saveSetting('themeMode', m);
  };

  const resolved = mode === 'system' ? systemScheme : mode;
  const t = resolved === 'dark' ? dark : light;

  const value = useMemo(() => ({ t, mode, setMode, resolved, ready }), [t, mode, resolved, ready]);
  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  return useContext(ThemeContext);
}

// Colour for a signed number, with a neutral tone for exactly-flat values.
export function toneFor(t, value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value === 0) return t.textMuted;
  return value > 0 ? t.up : t.down;
}

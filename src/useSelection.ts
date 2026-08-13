import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'stock-app.selection';

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    // A corrupt or unreadable store should never break the list.
    return [];
  }
}

export interface Selection {
  isSelected: (symbol: string) => boolean;
  toggle: (symbol: string) => void;
  count: number;
}

/**
 * The user's chosen stocks, kept on the device. Selection order is not
 * meaningful — the system decides what to do with the set.
 */
export function useSelection(): Selection {
  const [symbols, setSymbols] = useState<string[]>(readStored);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
    } catch {
      // Private mode or a full store: selection just won't survive a reload.
    }
  }, [symbols]);

  const toggle = useCallback((symbol: string) => {
    setSymbols((current) =>
      current.includes(symbol)
        ? current.filter((s) => s !== symbol)
        : [...current, symbol],
    );
  }, []);

  const isSelected = useCallback(
    (symbol: string) => symbols.includes(symbol),
    [symbols],
  );

  return { isSelected, toggle, count: symbols.length };
}

import { useSyncExternalStore } from 'react';

/**
 * The user's chosen stocks, kept on the device.
 *
 * A module-level store rather than per-component state: Ranks, ticker
 * detail, and Portfolio must never disagree about what is selected.
 */

const STORAGE_KEY = 'stock-app.selection';

function read(): string[] {
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

let symbols: string[] = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Another tab changing the selection counts as a change here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    symbols = read();
    emit();
  });
}

export function toggleSelection(symbol: string): void {
  symbols = symbols.includes(symbol)
    ? symbols.filter((s) => s !== symbol)
    : [...symbols, symbol];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  } catch {
    // Private mode or a full store: selection just won't survive a reload.
  }
  emit();
}

function getSnapshot(): string[] {
  return symbols;
}

/** The selected symbols. Every caller sees the same array instance. */
export function useSelectedSymbols(): string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// App state: what you selected, what you hid, how you weighted it.
//
// Everything here is persisted, so a basket built on the train is still there
// the next morning.

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { loadSetting, saveSetting } from './store';

const AppStateContext = createContext(null);

const DEFAULT_FILTERS = {
  sectors: [], // empty = all sectors
  measure: 'blended',
  sortKey: 'rank',
  sortDir: 'asc',
  scope: 'global', // 'global' ranks vs 'sector' ranks
  minPrice: null,
  onlySelected: false,
};

export function AppStateProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState([]);
  const [hidden, setHidden] = useState([]);
  const [weights, setWeights] = useState({});
  const [portfolioValue, setPortfolioValue] = useState(10000);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    let alive = true;
    Promise.all([
      loadSetting('selected', []),
      loadSetting('hidden', []),
      loadSetting('weights', {}),
      loadSetting('portfolioValue', 10000),
      loadSetting('filters', DEFAULT_FILTERS),
      loadSetting('recent', []),
    ]).then(([s, h, w, v, f, r]) => {
      if (!alive) return;
      setSelected(Array.isArray(s) ? s : []);
      setHidden(Array.isArray(h) ? h : []);
      setWeights(w && typeof w === 'object' ? w : {});
      setPortfolioValue(typeof v === 'number' ? v : 10000);
      setFilters({ ...DEFAULT_FILTERS, ...(f || {}) });
      setRecent(Array.isArray(r) ? r : []);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persistSelected = (next) => {
    setSelected(next);
    saveSetting('selected', next);
  };
  const persistHidden = (next) => {
    setHidden(next);
    saveSetting('hidden', next);
  };
  const persistWeights = (next) => {
    setWeights(next);
    saveSetting('weights', next);
  };

  const api = useMemo(() => {
    const isSelected = (symbol) => selected.includes(symbol);

    return {
      ready,
      selected,
      hidden,
      weights,
      portfolioValue,
      filters,
      recent,

      isSelected,
      isHidden: (symbol) => hidden.includes(symbol),

      toggleSelected: (symbol) => {
        if (selected.includes(symbol)) {
          persistSelected(selected.filter((s) => s !== symbol));
          const w = { ...weights };
          delete w[symbol];
          persistWeights(w);
        } else {
          persistSelected([...selected, symbol]);
        }
      },

      clearSelected: () => {
        persistSelected([]);
        persistWeights({});
      },

      toggleHidden: (symbol) => {
        if (hidden.includes(symbol)) persistHidden(hidden.filter((s) => s !== symbol));
        else persistHidden([...hidden, symbol]);
      },

      clearHidden: () => persistHidden([]),

      // Weight in percent. Unset symbols are treated as equal weight.
      setWeight: (symbol, value) => {
        const next = { ...weights, [symbol]: value };
        persistWeights(next);
      },

      // Replaces the whole weight map in one go. Editing one holding has to
      // pin every other holding at the same instant, and doing that with
      // repeated setWeight calls would read stale state between renders.
      setWeights: (map) => persistWeights({ ...map }),

      resetWeights: () => persistWeights({}),

      setPortfolioValue: (v) => {
        setPortfolioValue(v);
        saveSetting('portfolioValue', v);
      },

      setFilters: (patch) => {
        const next = typeof patch === 'function' ? patch(filters) : { ...filters, ...patch };
        setFilters(next);
        saveSetting('filters', next);
      },

      resetFilters: () => {
        setFilters(DEFAULT_FILTERS);
        saveSetting('filters', DEFAULT_FILTERS);
      },

      noteVisit: (symbol) => {
        const next = [symbol, ...recent.filter((s) => s !== symbol)].slice(0, 12);
        setRecent(next);
        saveSetting('recent', next);
      },

      // Settings' "clear saved data" must reset the in-memory copies too;
      // otherwise the next noteVisit() writes the old history straight back.
      clearRecent: () => {
        setRecent([]);
        saveSetting('recent', []);
      },

      // Holdings with weights resolved: anything the user has not explicitly
      // weighted gets an equal 1/n share, and the whole set is normalised
      // downstream. (Deliberately NOT "the remainder": if explicit weights
      // already sum to 100, a newly added name would get 0% and look broken.
      // The Portfolio screen pins every weight on first edit, so this default
      // only applies to names never touched there.)
      holdings: () => {
        if (selected.length === 0) return [];
        const explicit = selected.filter((s) => typeof weights[s] === 'number' && weights[s] >= 0);
        if (explicit.length === selected.length) {
          const total = explicit.reduce((sum, s) => sum + weights[s], 0);
          if (total > 0) return selected.map((s) => ({ symbol: s, weight: weights[s] }));
        }
        const equal = 100 / selected.length;
        return selected.map((s) => ({
          symbol: s,
          weight: typeof weights[s] === 'number' ? weights[s] : equal,
        }));
      },
    };
  }, [ready, selected, hidden, weights, portfolioValue, filters, recent]);

  return React.createElement(AppStateContext.Provider, { value: api }, children);
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}

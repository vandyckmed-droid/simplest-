/**
 * Fake price history, generated deterministically from each stock's own
 * fixture values.
 *
 * This is a stand-in for real price data, not a calculation the product
 * performs: a seeded walk shaped by the stock's volatility and 12–1 return,
 * rescaled so it ends at the fixture price. The same symbol always produces
 * the same series, so the graph never changes shape between renders.
 */

import type { Stock, WindowId } from '../types';

/** Trading days shown for each window. */
const WINDOW_DAYS: Record<WindowId, number> = {
  '1M': 22,
  '3M': 66,
  '6M': 126,
  '1Y': 252,
  '2Y': 504,
};

export const WINDOWS: WindowId[] = ['1M', '3M', '6M', '1Y', '2Y'];
export const DEFAULT_WINDOW: WindowId = '1Y';

/** The longest window is generated once; the rest are its tail. */
const TOTAL_DAYS = WINDOW_DAYS['2Y'];

/** At most this many points are drawn, whatever the window length. */
const MAX_POINTS = 130;

function seedFrom(symbol: string): number {
  let hash = 2166136261;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = Math.imul(hash ^ symbol.charCodeAt(i), 16777619);
  }
  return hash >>> 0;
}

function randomSource(seed: number): () => number {
  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

/** Roughly normal, and good enough for a decorative walk. */
function gaussian(next: () => number): number {
  return (next() + next() + next() - 1.5) * 2;
}

const cache = new Map<string, number[]>();

function fullSeries(stock: Stock): number[] {
  const cached = cache.get(stock.symbol);
  if (cached) return cached;

  const next = randomSource(seedFrom(stock.symbol));
  const daily = stock.volatility / Math.sqrt(252);
  // Drift chosen so the 1Y slice lands near the stock's stated return.
  const drift = Math.log(1 + stock.return121) / 252;

  const prices: number[] = [1];
  for (let day = 1; day < TOTAL_DAYS; day += 1) {
    const step = drift + daily * gaussian(next);
    prices.push(prices[day - 1] * Math.exp(step));
  }

  // Rescale so the walk ends at today's price without changing its shape.
  const scale = stock.price / prices[prices.length - 1];
  const series = prices.map((p) => p * scale);
  cache.set(stock.symbol, series);
  return series;
}

/** The price points to draw for one stock over one window. */
export function seriesFor(stock: Stock, window: WindowId): number[] {
  const full = fullSeries(stock);
  const slice = full.slice(Math.max(0, full.length - WINDOW_DAYS[window]));
  const step = Math.ceil(slice.length / MAX_POINTS);
  if (step <= 1) return slice;

  const points = slice.filter((_, i) => i % step === 0);
  // Always keep the latest price as the final point.
  const last = slice[slice.length - 1];
  if (points[points.length - 1] !== last) points.push(last);
  return points;
}

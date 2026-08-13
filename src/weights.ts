import { RANKS } from './data/fixtures';
import type { WeightedHolding } from './types';

/**
 * The system decides the weights; the user only decides the members.
 *
 * Phase 4 weights every holding equally. Weights are distributed in tenths
 * of a percent by largest remainder, so the numbers on screen add to exactly
 * 100.0% rather than to 99.9% — with three holdings, that is 33.4 / 33.3 /
 * 33.3 rather than three thirds that quietly lose a tenth.
 */

/** Tenths of a percent. Matches the precision weights are displayed at. */
const UNITS = 1000;

export function equalWeights(count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(UNITS / count);
  const remainder = UNITS - base * count;
  return Array.from(
    { length: count },
    (_, i) => (base + (i < remainder ? 1 : 0)) / UNITS,
  );
}

/**
 * The selected symbols as holdings, in ranked order so the list is stable
 * however the stocks were picked.
 */
export function portfolioFor(selected: string[]): WeightedHolding[] {
  const members = RANKS.filter((stock) => selected.includes(stock.symbol));
  const weights = equalWeights(members.length);
  return members.map((stock, i) => ({
    symbol: stock.symbol,
    name: stock.name,
    weight: weights[i],
  }));
}

export function totalWeight(holdings: WeightedHolding[]): number {
  return holdings.reduce((sum, holding) => sum + holding.weight, 0);
}

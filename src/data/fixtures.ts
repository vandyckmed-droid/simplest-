/**
 * Static fake data for the Phase 1 shell and the Phase 2 Ranks screen.
 *
 * Nothing here is computed — not the momentum scores, not the returns, not
 * the portfolio totals or weights. Real data and the calculations behind it
 * arrive in later phases; this file exists so the layout can be judged with
 * realistic content.
 */

import type { Holding, Stock } from '../types';

export const RANKS: Stock[] = [
  { rank: 1, symbol: 'NVDA', name: 'NVIDIA', momentum: 96.4, return12m: 1.842 },
  { rank: 2, symbol: 'AVGO', name: 'Broadcom', momentum: 93.1, return12m: 0.914 },
  { rank: 3, symbol: 'CEG', name: 'Constellation Energy', momentum: 91.7, return12m: 1.126 },
  { rank: 4, symbol: 'LLY', name: 'Eli Lilly', momentum: 88.2, return12m: 0.573 },
  { rank: 5, symbol: 'ANET', name: 'Arista Networks', momentum: 85.9, return12m: 0.648 },
  { rank: 6, symbol: 'COST', name: 'Costco Wholesale', momentum: 82.4, return12m: 0.412 },
  { rank: 7, symbol: 'GE', name: 'GE Aerospace', momentum: 79.8, return12m: 0.487 },
  { rank: 8, symbol: 'AXP', name: 'American Express', momentum: 76.3, return12m: 0.361 },
  { rank: 9, symbol: 'WMT', name: 'Walmart', momentum: 74.1, return12m: 0.298 },
  { rank: 10, symbol: 'JPM', name: 'JPMorgan Chase', momentum: 71.6, return12m: 0.234 },
];

export const RANKS_SUBTITLE = 'Momentum blend · Aug 13';

export const HOLDINGS: Holding[] = [
  { symbol: 'NVDA', name: 'NVIDIA', weight: 0.184, value: 4472.18, dayChange: 0.0284 },
  { symbol: 'COST', name: 'Costco Wholesale', weight: 0.161, value: 3913.06, dayChange: 0.0042 },
  { symbol: 'LLY', name: 'Eli Lilly', weight: 0.148, value: 3597.14, dayChange: -0.0071 },
  { symbol: 'AAPL', name: 'Apple', weight: 0.137, value: 3329.72, dayChange: 0.0118 },
  { symbol: 'AXP', name: 'American Express', weight: 0.126, value: 3062.41, dayChange: 0.0087 },
  { symbol: 'GE', name: 'GE Aerospace', weight: 0.098, value: 2381.87, dayChange: 0.0209 },
  { symbol: 'WMT', name: 'Walmart', weight: 0.081, value: 1968.55, dayChange: 0.0051 },
  { symbol: 'JPM', name: 'JPMorgan Chase', weight: 0.065, value: 1579.93, dayChange: 0.0033 },
];

export const PORTFOLIO_SUMMARY = {
  value: 24304.86,
  dayChangeValue: 287.41,
  dayChange: 0.0119,
  holdingsLabel: 'Holdings · 8 stocks',
  footnote: 'Weights are set automatically.',
};

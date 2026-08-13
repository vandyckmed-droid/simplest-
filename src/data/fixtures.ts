/**
 * Static fake data for the shell, Ranks, and ticker detail.
 *
 * Nothing here is computed — not the momentum scores, not the returns, not
 * the volatilities, not the portfolio totals or weights. Real data and the
 * calculations behind it arrive in later phases; this file exists so the
 * layout can be judged with realistic content.
 */

import type { Holding, Stock } from '../types';

export const RANKS: Stock[] = [
  { rank: 1, symbol: 'NVDA', name: 'NVIDIA', price: 138.42, dayChange: 0.0284, momentum: 96.4, return121: 1.842, volatility: 0.512 },
  { rank: 2, symbol: 'AVGO', name: 'Broadcom', price: 242.18, dayChange: 0.0163, momentum: 93.1, return121: 0.914, volatility: 0.408 },
  { rank: 3, symbol: 'CEG', name: 'Constellation Energy', price: 254.13, dayChange: 0.0317, momentum: 91.7, return121: 1.126, volatility: 0.446 },
  { rank: 4, symbol: 'LLY', name: 'Eli Lilly', price: 812.55, dayChange: -0.0071, momentum: 88.2, return121: 0.573, volatility: 0.318 },
  { rank: 5, symbol: 'ANET', name: 'Arista Networks', price: 371.28, dayChange: 0.0246, momentum: 85.9, return121: 0.648, volatility: 0.374 },
  { rank: 6, symbol: 'COST', name: 'Costco Wholesale', price: 921.04, dayChange: 0.0042, momentum: 82.4, return121: 0.412, volatility: 0.201 },
  { rank: 7, symbol: 'GE', name: 'GE Aerospace', price: 186.72, dayChange: 0.0209, momentum: 79.8, return121: 0.487, volatility: 0.286 },
  { rank: 8, symbol: 'AXP', name: 'American Express', price: 274.63, dayChange: 0.0087, momentum: 76.3, return121: 0.361, volatility: 0.243 },
  { rank: 9, symbol: 'WMT', name: 'Walmart', price: 80.46, dayChange: 0.0051, momentum: 74.1, return121: 0.298, volatility: 0.192 },
  { rank: 10, symbol: 'JPM', name: 'JPMorgan Chase', price: 218.94, dayChange: 0.0033, momentum: 71.6, return121: 0.234, volatility: 0.224 },
];

export const RANKS_SUBTITLE = 'Momentum blend · Aug 13';

export function findStock(symbol: string): Stock | undefined {
  return RANKS.find((stock) => stock.symbol === symbol);
}

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

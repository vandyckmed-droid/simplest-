/**
 * Static fake data for the Phase 1 shell.
 *
 * Nothing here is computed — including the portfolio totals and weights.
 * Real data and the calculations behind it arrive in later phases; this file
 * exists so the layout can be judged with realistic content.
 */

import type { Holding, Stock } from '../types';

export const RANKS: Stock[] = [
  { rank: 1, symbol: 'NVDA', name: 'NVIDIA', price: 138.42, dayChange: 0.0284 },
  { rank: 2, symbol: 'AVGO', name: 'Broadcom', price: 242.18, dayChange: 0.0163 },
  { rank: 3, symbol: 'LLY', name: 'Eli Lilly', price: 812.55, dayChange: -0.0071 },
  { rank: 4, symbol: 'COST', name: 'Costco Wholesale', price: 921.04, dayChange: 0.0042 },
  { rank: 5, symbol: 'AAPL', name: 'Apple', price: 229.87, dayChange: 0.0118 },
  { rank: 6, symbol: 'MSFT', name: 'Microsoft', price: 417.31, dayChange: -0.0026 },
  { rank: 7, symbol: 'GE', name: 'GE Aerospace', price: 186.72, dayChange: 0.0209 },
  { rank: 8, symbol: 'AXP', name: 'American Express', price: 274.63, dayChange: 0.0087 },
  { rank: 9, symbol: 'NFLX', name: 'Netflix', price: 703.19, dayChange: -0.0134 },
  { rank: 10, symbol: 'WMT', name: 'Walmart', price: 80.46, dayChange: 0.0051 },
  { rank: 11, symbol: 'JPM', name: 'JPMorgan Chase', price: 218.94, dayChange: 0.0033 },
  { rank: 12, symbol: 'ANET', name: 'Arista Networks', price: 371.28, dayChange: 0.0246 },
  { rank: 13, symbol: 'PGR', name: 'Progressive', price: 252.77, dayChange: -0.0048 },
  { rank: 14, symbol: 'ORCL', name: 'Oracle', price: 172.36, dayChange: 0.0192 },
  { rank: 15, symbol: 'TT', name: 'Trane Technologies', price: 396.51, dayChange: 0.0061 },
  { rank: 16, symbol: 'KKR', name: 'KKR & Co.', price: 141.09, dayChange: -0.0095 },
  { rank: 17, symbol: 'MMM', name: '3M', price: 135.82, dayChange: 0.0074 },
  { rank: 18, symbol: 'CEG', name: 'Constellation Energy', price: 254.13, dayChange: 0.0317 },
];

export const RANKS_UNIVERSE_LABEL = '4,182 stocks · as of Aug 13';

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

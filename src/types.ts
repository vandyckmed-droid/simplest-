/** Shared shapes. Market values come from `src/data/market.json`. */

/** An adjusted daily close series, oldest first. */
export interface History {
  dates: string[];
  closes: number[];
}

/** The 12–1 momentum figures for one stock, cross-sectionally ranked. */
export interface Momentum12_1 {
  return12_1: number;
  volatility: number;
  riskAdjusted: number | null;
  /** Percentile of the risk-adjusted value across the field, 0–100. */
  percentile: number | null;
  /** The window's first and last trading dates. */
  from: string;
  to: string;
}

export interface Stock {
  /** Position in the list. Ranked by market cap until momentum exists. */
  rank: number;
  symbol: string;
  name: string;
  /** Latest adjusted close, in dollars. */
  price: number;
  /** Change from the previous adjusted close, as a fraction. */
  dayChange: number;
  marketCap: number;
  /** Date of the latest close, e.g. "2026-08-12". */
  asOf: string;
  history: History;
  /** Null when the history is too short to cover the 12–1 window. */
  momentum: Momentum12_1 | null;
}

/** A selected stock and the weight the system gave it. Never authored. */
export interface WeightedHolding {
  symbol: string;
  name: string;
  /** Portfolio weight, as a fraction (0.25 = 25%). */
  weight: number;
}

export type TabId = 'ranks' | 'portfolio';

/** Graph windows offered on ticker detail. */
export type WindowId = '1M' | '3M' | '6M' | '1Y' | '2Y';

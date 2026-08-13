/** Shared shapes. Market values come from `src/data/market.json`. */

/** An adjusted daily close series, oldest first. */
export interface History {
  dates: string[];
  closes: number[];
}

/** One momentum window for one stock, cross-sectionally ranked. */
export interface MomentumWindow {
  totalReturn: number;
  volatility: number;
  riskAdjusted: number | null;
  /** Percentile of the risk-adjusted value across the field, 0–100. */
  percentile: number | null;
  /** The window's first and last trading dates. */
  from: string;
  to: string;
}

export interface Stock {
  /** Position in the list, by Momentum Blend. */
  rank: number;
  symbol: string;
  name: string;
  /** NYSE, NASDAQ or AMEX (NYSE American). */
  exchange: string;
  /** Latest adjusted close, in dollars. */
  price: number;
  /** Change from the previous adjusted close, as a fraction. */
  dayChange: number;
  marketCap: number;
  /** Median daily dollar volume that put this stock in the universe. */
  medianDollarVolume: number;
  /** Date of the latest close, e.g. "2026-08-12". */
  asOf: string;
  history: History;
  /** Null when the history is too short to cover the window. */
  momentum12_1: MomentumWindow | null;
  momentum6_1: MomentumWindow | null;
  /** Half the 12–1 percentile plus half the 6–1 percentile, 0–100. */
  blend: number | null;
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

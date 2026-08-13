/** Shared shapes. Market values come from `src/data/market.json`. */

/** An adjusted daily close series, oldest first. */
export interface History {
  dates: string[];
  closes: number[];
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

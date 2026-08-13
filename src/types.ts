/** Shared shapes. Phase 3 still fills these from static fixtures only. */

export interface Stock {
  /** Position in the ranked list. */
  rank: number;
  symbol: string;
  name: string;
  /** Last price, in dollars. */
  price: number;
  /** Day change, as a fraction (0.0284 = +2.84%). */
  dayChange: number;
  /** Composite momentum score, 0–100. The list is ordered by this. */
  momentum: number;
  /** 12-month return excluding the most recent month, as a fraction. */
  return121: number;
  /** Annualised volatility, as a fraction (0.412 = 41.2%). */
  volatility: number;
}

export interface Holding {
  symbol: string;
  name: string;
  /** Portfolio weight, as a fraction (0.184 = 18.4%). */
  weight: number;
  /** Position value, in dollars. */
  value: number;
  /** Day change, as a fraction. */
  dayChange: number;
}

export type TabId = 'ranks' | 'portfolio';

/** Graph windows offered on ticker detail. */
export type WindowId = '1M' | '3M' | '6M' | '1Y' | '2Y';

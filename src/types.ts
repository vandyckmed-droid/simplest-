/** Shared shapes. Phase 1 fills these from static fixtures only. */

export interface Stock {
  /** Position in the ranked list. */
  rank: number;
  symbol: string;
  name: string;
  /** Last price, in dollars. */
  price: number;
  /** Day change, as a fraction (0.0182 = +1.82%). */
  dayChange: number;
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

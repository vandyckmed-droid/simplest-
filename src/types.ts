/** Shared shapes. Phase 2 still fills these from static fixtures only. */

export interface Stock {
  /** Position in the ranked list. */
  rank: number;
  symbol: string;
  name: string;
  /** Composite momentum score, 0–100. The list is ordered by this. */
  momentum: number;
  /** Trailing 12-month return, as a fraction (0.482 = +48.2%). */
  return12m: number;
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

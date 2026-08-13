/**
 * The 12–1 momentum signal.
 *
 * Pure functions over an ascending series of adjusted closes. Nothing here
 * reads global state or the clock, so the same prices always give the same
 * numbers, and every step can be checked by hand (see `tools/test-momentum.ts`).
 *
 * Conventions
 * -----------
 * Trading day −k is `closes[closes.length - 1 - k]`; day 0 is the latest close.
 * The 12–1 window runs from day −252 through day −21 inclusive: a year of
 * prices with the most recent month skipped, which is the standard way to
 * measure momentum without the short-term reversal in the last few weeks.
 */

/** Trading days back to where the window opens. */
export const LOOKBACK_DAYS = 252;
/** Trading days skipped at the recent end. */
export const SKIP_DAYS = 21;
/** Trading days in a year, for annualising volatility. */
export const TRADING_DAYS_PER_YEAR = 252;
/**
 * Volatility at or below this counts as none at all. A price line that never
 * moves still leaves floating-point crumbs of around 1e-16, and dividing by
 * those would report a ratio in the quadrillions instead of "no risk here".
 */
export const MIN_VOLATILITY = 1e-8;

export interface WindowOptions {
  lookback?: number;
  skip?: number;
}

export interface Momentum {
  /** Simple return from the open of the window to its close. */
  return12_1: number;
  /** Annualised realised volatility of daily log returns in the window. */
  volatility: number;
  /** Return divided by volatility. Null when volatility is zero. */
  riskAdjusted: number | null;
  /** The window actually used, as indices into the close series. */
  fromIndex: number;
  toIndex: number;
}

/**
 * The closes covering day −lookback through day −skip, inclusive.
 * Returns null when the series is too short to cover the window.
 */
export function windowSlice(
  closes: number[],
  { lookback = LOOKBACK_DAYS, skip = SKIP_DAYS }: WindowOptions = {},
): { slice: number[]; fromIndex: number; toIndex: number } | null {
  if (lookback <= skip) return null;
  const last = closes.length - 1;
  const fromIndex = last - lookback;
  const toIndex = last - skip;
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= toIndex) return null;

  const slice = closes.slice(fromIndex, toIndex + 1);
  if (slice.some((price) => !Number.isFinite(price) || price <= 0)) return null;
  return { slice, fromIndex, toIndex };
}

/** Simple return across a slice: last / first − 1. */
export function totalReturn(slice: number[]): number {
  return slice[slice.length - 1] / slice[0] - 1;
}

/** Daily log returns within a slice. One fewer than the number of prices. */
export function logReturns(slice: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i += 1) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  return returns;
}

/**
 * Annualised realised volatility: the sample standard deviation of daily log
 * returns, scaled by the square root of a trading year.
 */
export function annualizedVolatility(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

/**
 * The 12–1 figures for one stock, or null when its history is too short.
 */
export function momentum12_1(closes: number[], options: WindowOptions = {}): Momentum | null {
  const window = windowSlice(closes, options);
  if (!window) return null;

  const return12_1 = totalReturn(window.slice);
  const volatility = annualizedVolatility(logReturns(window.slice));

  return {
    return12_1,
    volatility,
    // A flat price line has no risk to adjust for; say so rather than divide.
    riskAdjusted: volatility > MIN_VOLATILITY ? return12_1 / volatility : null,
    fromIndex: window.fromIndex,
    toIndex: window.toIndex,
  };
}

/**
 * Cross-sectional percentile of each value: the share of the field it beats,
 * from 0 for the weakest to 100 for the strongest.
 *
 *   percentile = 100 × (how many values are strictly lower) / (count − 1)
 *
 * Ties therefore share the lower percentile, and a single value is 100.
 * Entries that are null keep a null percentile and are left out of the field.
 */
export function percentileRanks(values: (number | null)[]): (number | null)[] {
  const ranked = values.filter((v): v is number => v !== null);
  if (ranked.length === 0) return values.map(() => null);
  if (ranked.length === 1) return values.map((v) => (v === null ? null : 100));

  return values.map((value) => {
    if (value === null) return null;
    const below = ranked.filter((other) => other < value).length;
    return (100 * below) / (ranked.length - 1);
  });
}

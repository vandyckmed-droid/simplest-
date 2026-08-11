// Volatility-adjusted momentum on daily adjusted closes.
//
// Both horizons skip the most recent month (the "-1" in 12-1 / 6-1), which is
// the standard way to sidestep short-term reversal contaminating the momentum
// signal.

export const TRADING_DAYS_PER_YEAR = 252;
export const SKIP_DAYS = 21;   // ~1 month, the gap that is excluded
export const LOOKBACK_12 = 252; // ~12 months
export const LOOKBACK_6 = 126;  // ~6 months

/**
 * @param {number[]} closes Adjusted closes, oldest first.
 * @param {number} lookback Bars back from today where the window opens.
 * @returns {{logReturn:number, annVol:number, sharpe:number}|null}
 */
function window(closes, lookback) {
  const n = closes.length;
  const end = n - 1 - SKIP_DAYS; // index of the window's last close
  const start = n - 1 - lookback; // index of the window's first close
  if (start < 0 || end <= start) return null;

  const pStart = closes[start];
  const pEnd = closes[end];
  if (!(pStart > 0) || !(pEnd > 0)) return null;

  const logReturn = Math.log(pEnd / pStart);

  // Daily log returns inside the same window drive the volatility estimate, so
  // the numerator and denominator describe the identical stretch of tape.
  const daily = [];
  for (let i = start + 1; i <= end; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) daily.push(Math.log(b / a));
  }
  if (daily.length < 20) return null;

  const mean = daily.reduce((s, x) => s + x, 0) / daily.length;
  const variance = daily.reduce((s, x) => s + (x - mean) ** 2, 0) / (daily.length - 1);
  const annVol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  if (!(annVol > 0)) return null;

  // Annualise the window return so the two horizons are on one scale, then
  // divide by annualised volatility: a Sharpe-like, unitless momentum score.
  const years = daily.length / TRADING_DAYS_PER_YEAR;
  const annReturn = logReturn / years;

  return { logReturn, annReturn, annVol, sharpe: annReturn / annVol };
}

/**
 * @param {{date:string, close:number, volume:number}[]} bars Oldest first.
 */
export function score(bars) {
  const closes = bars.map((b) => b.close);
  const w12 = window(closes, LOOKBACK_12);
  const w6 = window(closes, LOOKBACK_6);
  if (!w12 || !w6) return null;

  // Median dollar volume over the last quarter — a liquidity check that is not
  // thrown off by one earnings-day volume spike.
  const recent = bars.slice(-63);
  const dollarVolumes = recent
    .map((b) => b.close * b.volume)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  const medianDollarVolume = dollarVolumes.length
    ? dollarVolumes[Math.floor(dollarVolumes.length / 2)]
    : 0;

  return {
    ret12_1: w12.logReturn,
    ret6_1: w6.logReturn,
    vol12: w12.annVol,
    vol6: w6.annVol,
    score12_1: w12.sharpe,
    score6_1: w6.sharpe,
    composite: (w12.sharpe + w6.sharpe) / 2,
    medianDollarVolume,
    bars: bars.length,
    lastDate: bars[bars.length - 1].date,
  };
}

// Average True Range - the "how far does this thing usually travel in a day"
// measure. Used to express portfolio risk in money terms rather than sigmas.

import { isNum } from './stats.js';

// True range for one bar: the widest of today's range, and today's high/low
// measured against yesterday's close (which captures overnight gaps).
export function trueRange(high, low, prevClose) {
  if (!isNum(high) || !isNum(low)) return null;
  const a = high - low;
  if (!isNum(prevClose)) return a;
  return Math.max(a, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

/**
 * Wilder's smoothed ATR.
 * bars: oldest-first [{ high, low, close }]
 * Returns the ATR in price units, or null when there is not enough history.
 */
export function atr(bars, period = 14) {
  if (!Array.isArray(bars) || bars.length < period + 1) return null;

  const trs = [];
  for (let i = 1; i < bars.length; i += 1) {
    const tr = trueRange(bars[i].high, bars[i].low, bars[i - 1].close);
    if (isNum(tr)) trs.push(tr);
  }
  if (trs.length < period) return null;

  // Seed with a simple average, then apply Wilder smoothing.
  let value = trs.slice(0, period).reduce((s, x) => s + x, 0) / period;
  for (let i = period; i < trs.length; i += 1) {
    value = (value * (period - 1) + trs[i]) / period;
  }
  return value;
}

// ATR as a percentage of the latest close - comparable across price levels.
export function atrPercent(bars, period = 14) {
  const a = atr(bars, period);
  const last = bars.length ? bars[bars.length - 1].close : null;
  if (!isNum(a) || !isNum(last) || last <= 0) return null;
  return a / last;
}

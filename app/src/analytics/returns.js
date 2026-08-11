// Return and volatility maths.
//
// Every window in this file is measured in TRADING DAYS, counted backwards from
// the most recent bar. Index 0 of a series is the OLDEST bar, the last index is
// the most recent one, which is how the pipeline stores prices.

import { TRADING_DAYS_PER_YEAR, isNum, stdev } from './stats.js';

// Price `lag` trading days before the end of the series. lag = 0 is the last bar.
export function priceAtLag(closes, lag) {
  const i = closes.length - 1 - lag;
  if (i < 0 || i >= closes.length) return null;
  const p = closes[i];
  return isNum(p) && p > 0 ? p : null;
}

// Simple total return between two lags, e.g. fromLag = 252, toLag = 21 is the
// classic 12-minus-1-month window (skips the most recent month).
export function totalReturn(closes, fromLag, toLag) {
  const p0 = priceAtLag(closes, fromLag);
  const p1 = priceAtLag(closes, toLag);
  if (p0 === null || p1 === null) return null;
  return p1 / p0 - 1;
}

// Daily log returns for the slice between two lags (inclusive of the endpoints'
// interior steps). Log returns keep the annualisation maths clean.
export function logReturnsBetween(closes, fromLag, toLag) {
  const start = closes.length - 1 - fromLag;
  const end = closes.length - 1 - toLag;
  if (start < 0 || end <= start) return [];
  const out = [];
  for (let i = start + 1; i <= end; i += 1) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (isNum(prev) && isNum(cur) && prev > 0 && cur > 0) out.push(Math.log(cur / prev));
  }
  return out;
}

export function dailyLogReturns(closes) {
  return logReturnsBetween(closes, closes.length - 1, 0);
}

// Turn a total return earned over `days` trading days into an annual rate.
// Geometric, so a 231-day window and a 105-day window are directly comparable.
export function annualiseReturn(totalRet, days) {
  if (!isNum(totalRet) || !isNum(days) || days <= 0) return null;
  const growth = 1 + totalRet;
  // A total wipe-out cannot be compounded; clamp so the maths stays defined.
  if (growth <= 0) return -1;
  return Math.pow(growth, TRADING_DAYS_PER_YEAR / days) - 1;
}

// Annualised standard deviation of daily log returns.
export function annualiseVolatility(dailyLogRets) {
  const sd = stdev(dailyLogRets);
  if (!isNum(sd)) return null;
  return sd * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

// Risk-adjusted momentum over one window: annualised return divided by the
// annualised volatility measured over THE SAME window.
//
// Returns the components as well as the ratio so the app can show its work.
export function riskAdjustedMomentum(closes, fromLag, toLag) {
  const days = fromLag - toLag;
  if (days <= 1) return null;
  if (closes.length < fromLag + 1) return null;

  const total = totalReturn(closes, fromLag, toLag);
  const rets = logReturnsBetween(closes, fromLag, toLag);
  if (total === null || rets.length < Math.floor(days * 0.6)) return null;

  const annReturn = annualiseReturn(total, days);
  const annVol = annualiseVolatility(rets);
  if (!isNum(annReturn) || !isNum(annVol) || annVol <= 0) return null;

  return {
    totalReturn: total,
    annReturn,
    annVol,
    ratio: annReturn / annVol,
    windowDays: days,
    observations: rets.length,
  };
}

// Rebase a series to 100 at its first valid point, for normalised comparison charts.
export function rebase(values, base = 100) {
  const first = values.find((v) => isNum(v) && v > 0);
  if (!isNum(first)) return values.map(() => null);
  return values.map((v) => (isNum(v) && v > 0 ? (v / first) * base : null));
}

// Rebase several series from their first COMMON valid index, for multi-line
// comparison charts. Rebasing each line at its own first bar would let a
// recently listed name appear at 100 mid-chart and make its return over a
// shorter window look comparable to the others'. Everything before the common
// start is nulled, so the chart and any return computed from the result cover
// one identical window. Returns { series, startIndex } (startIndex −1 when the
// series never overlap).
export function rebaseTogether(seriesList, base = 100) {
  const n = seriesList.length ? Math.max(...seriesList.map((s) => s.length)) : 0;
  let start = -1;
  for (let i = 0; i < n; i += 1) {
    if (seriesList.every((s) => isNum(s[i]) && s[i] > 0)) {
      start = i;
      break;
    }
  }
  if (start === -1) return { series: seriesList.map((s) => s.map(() => null)), startIndex: -1 };
  return {
    series: seriesList.map((s) =>
      s.map((v, i) => (i >= start && isNum(v) && v > 0 ? (v / s[start]) * base : null))
    ),
    startIndex: start,
  };
}

export function maxDrawdown(closes) {
  let peak = -Infinity;
  let worst = 0;
  for (const p of closes) {
    if (!isNum(p) || p <= 0) continue;
    if (p > peak) peak = p;
    const dd = p / peak - 1;
    if (dd < worst) worst = dd;
  }
  return worst;
}

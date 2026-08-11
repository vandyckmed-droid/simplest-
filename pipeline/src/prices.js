// Price history: fetch, clean, and describe.
//
// Cleaning matters more than fetching here. Duplicate dates, zero-volume stubs
// and out-of-order rows all silently corrupt momentum and volatility if they are
// left in, so every row is validated before it reaches the analytics layer.

import { fmpGet, mapLimit } from './fmp.js';
import { median } from '../../app/src/analytics/stats.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Fetches dividend- and split-adjusted daily bars, oldest first.
 * Falls back to the unadjusted endpoint for instruments the adjusted one does
 * not cover (some commodity and crypto lines), and records which was used.
 */
export async function fetchHistory(symbol, from, to) {
  const adj = await fmpGet('historical-price-eod/dividend-adjusted', { symbol, from, to });

  let rows = null;
  let source = 'dividend-adjusted';
  if (adj.ok && Array.isArray(adj.data) && adj.data.length > 0) {
    rows = adj.data.map((r) => ({
      date: r.date,
      open: r.adjOpen,
      high: r.adjHigh,
      low: r.adjLow,
      close: r.adjClose,
      volume: r.volume,
    }));
  } else {
    const full = await fmpGet('historical-price-eod/full', { symbol, from, to });
    if (full.ok && Array.isArray(full.data) && full.data.length > 0) {
      rows = full.data.map((r) => ({
        date: r.date,
        open: r.open,
        high: r.high,
        low: r.low,
        close: r.close,
        volume: r.volume,
      }));
      source = 'unadjusted';
    } else {
      return { ok: false, error: adj.error || full.error || 'no rows returned', symbol };
    }
  }

  const { bars, issues } = cleanBars(rows);
  if (bars.length === 0) return { ok: false, error: 'no usable bars after cleaning', symbol };
  return { ok: true, symbol, bars, source, issues };
}

// Sorts oldest-first, removes duplicate dates, and drops rows that cannot be
// trusted. Returns the problems it found so the build report can show them.
export function cleanBars(rows) {
  const issues = { duplicateDates: 0, badRows: 0, repairedHighLow: 0 };
  const byDate = new Map();

  for (const r of rows) {
    if (!r || !DATE_RE.test(String(r.date))) {
      issues.badRows += 1;
      continue;
    }
    const close = Number(r.close);
    if (!Number.isFinite(close) || close <= 0) {
      issues.badRows += 1;
      continue;
    }

    let high = Number(r.high);
    let low = Number(r.low);
    let open = Number(r.open);
    if (!Number.isFinite(open) || open <= 0) open = close;
    if (!Number.isFinite(high) || high <= 0) high = Math.max(open, close);
    if (!Number.isFinite(low) || low <= 0) low = Math.min(open, close);
    // A high below the low (or below the close) is a bad print, not a real bar.
    if (high < low || high < close || low > close) {
      high = Math.max(open, close, high);
      low = Math.min(open, close, low);
      issues.repairedHighLow += 1;
    }

    const volume = Number.isFinite(Number(r.volume)) ? Number(r.volume) : 0;

    if (byDate.has(r.date)) issues.duplicateDates += 1;
    byDate.set(r.date, { date: r.date, open, high, low, close, volume });
  }

  const bars = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { bars, issues };
}

// Liquidity and coverage facts used by the universe gate.
export function describeBars(bars, lookbackDays) {
  const tail = bars.slice(-lookbackDays);
  const dollarVolumes = tail.map((b) => b.close * b.volume).filter((x) => Number.isFinite(x));
  const tradedDays = tail.filter((b) => b.volume > 0).length;
  return {
    bars: bars.length,
    firstDate: bars.length ? bars[0].date : null,
    lastDate: bars.length ? bars[bars.length - 1].date : null,
    lastClose: bars.length ? bars[bars.length - 1].close : null,
    medianDollarVolume: median(dollarVolumes) || 0,
    tradedDaysRatio: tail.length ? tradedDays / tail.length : 0,
  };
}

export async function fetchMany(symbols, from, to, log, concurrency = 8) {
  let done = 0;
  const results = await mapLimit(symbols, concurrency, async (symbol) => {
    const r = await fetchHistory(symbol, from, to);
    done += 1;
    if (done % 50 === 0) log.info(`history ${done}/${symbols.length}`);
    if (!r.ok) log.warn(`history failed for ${symbol}: ${r.error}`);
    return r;
  });
  return results;
}

/**
 * Builds one shared trading calendar and re-indexes every security onto it.
 *
 * The calendar is defined by `calendarSymbols` - the equity lines - because
 * those are the days the market is actually open. Bitcoin trades weekends and
 * spot gold trades nearly around the clock; letting their dates into the
 * calendar would stretch a "252 trading day" window across only about nine
 * months of market activity and quietly corrupt every momentum number.
 * Those instruments are instead sampled on equity days.
 *
 * A security that did not trade on a calendar date gets `null`, never a
 * carried-forward price - the analytics layer treats null as "no observation"
 * so gaps cannot masquerade as flat days.
 */
export function alignToCalendar(seriesBySymbol, calendarSymbols = null) {
  const dateSet = new Set();
  const sources = calendarSymbols && calendarSymbols.length
    ? calendarSymbols.filter((s) => seriesBySymbol[s])
    : Object.keys(seriesBySymbol);
  for (const s of sources) {
    for (const b of seriesBySymbol[s]) dateSet.add(b.date);
  }
  const dates = [...dateSet].sort();
  const index = new Map(dates.map((d, i) => [d, i]));

  const closes = {};
  for (const [symbol, bars] of Object.entries(seriesBySymbol)) {
    const arr = new Array(dates.length).fill(null);
    for (const b of bars) {
      const i = index.get(b.date);
      // Off-calendar observations (weekend crypto prints) are simply not sampled.
      if (i !== undefined) arr[i] = b.close;
    }
    closes[symbol] = arr;
  }
  return { dates, closes };
}

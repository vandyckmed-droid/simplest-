// Builds data/ranks.json: every tradeable US name that clears a liquidity
// floor, ranked on the blend of volatility-adjusted 12-1 and 6-1 momentum.
//
//   node src/ranks-build.js

import { mkdir, writeFile } from 'node:fs/promises';
import { dailyAdjusted, pooled, screener } from './fmp.js';
import { score } from './momentum.js';
import { clean } from './universe.js';

const MIN_PRICE = 5;
const MIN_MEDIAN_DOLLAR_VOLUME = 25e6;
// The screener reports one session's volume, which is noisy, so candidates come
// in on a loose version of the floor and the real test runs on 63-session
// median dollar volume once the history is in hand.
const CANDIDATE_DOLLAR_VOLUME = 12e6;
const MIN_MARKET_CAP = 1e8;
const MIN_BARS = 253;
const CONCURRENCY = 10;

// Correlation basis: one year of weekly log returns, sampled every 5 sessions.
const WEEK = 5;
const WEEKS = 52;
const QUANT = 180; // int8 scale for the standardised weekly vector

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/**
 * Standardised weekly log returns, quantised to int8 and base64'd. The page
 * re-centres and re-normalises on load, so a dot product of two decoded
 * vectors is the pair's correlation.
 */
function correlationVector(closes) {
  const n = closes.length;
  const samples = [];
  for (let i = n - 1; i >= 0 && samples.length <= WEEKS; i -= WEEK) samples.push(closes[i]);
  samples.reverse();
  if (samples.length < WEEKS + 1) return null;

  const r = [];
  for (let i = 1; i < samples.length; i++) r.push(Math.log(samples[i] / samples[i - 1]));

  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const centred = r.map((x) => x - mean);
  const norm = Math.sqrt(centred.reduce((s, x) => s + x * x, 0));
  if (!(norm > 0)) return null;

  const bytes = Buffer.from(
    centred.map((x) => Math.max(-127, Math.min(127, Math.round((x / norm) * QUANT)))),
  );
  return { b64: bytes.toString('base64'), exact: centred.map((x) => x / norm) };
}

async function main() {
  console.log('Fetching universe…');
  const raw = await screener({
    marketCapMoreThan: MIN_MARKET_CAP,
    volumeMoreThan: 0,
    limit: 10000,
  });
  console.log(`  ${raw.length} raw rows`);

  const { rows: candidates, dropped } = clean(raw, {
    minPrice: MIN_PRICE,
    minDollarVolume: CANDIDATE_DOLLAR_VOLUME,
  });
  console.log(
    `  dropped: ${Object.entries(dropped).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  );
  console.log(`Fetching ${candidates.length} price histories…`);

  const from = isoDaysAgo(430);
  const to = new Date().toISOString().slice(0, 10);

  // A fetch failure and a filtered-out name both produce "no row", but only the
  // first is worth retrying — otherwise a rate-limit blip silently shrinks the
  // universe and looks like a liquidity screen doing its job.
  const failed = [];
  let done = 0;

  const measure = async (row) => {
    let bars;
    try {
      bars = await dailyAdjusted(row.symbol, from, to);
    } catch (err) {
      failed.push(row);
      return null;
    } finally {
      if (++done % 200 === 0) console.log(`  ${done}/${candidates.length}`);
    }
    if (!Array.isArray(bars) || bars.length < MIN_BARS) return null;

    const series = bars
      .map((b) => ({ date: b.date, close: b.adjClose, volume: b.volume }))
      .filter((b) => Number.isFinite(b.close) && b.close > 0)
      .reverse();

    const metrics = score(series);
    if (!metrics) return null;
    if (metrics.medianDollarVolume < MIN_MEDIAN_DOLLAR_VOLUME) return null;

    const corr = correlationVector(series.map((b) => b.close));
    if (!corr) return null;

    return {
      symbol: row.symbol,
      name: row.companyName,
      sector: row.sector ?? null,
      industry: row.industry ?? null,
      exchange: row.exchangeShortName,
      marketCap: row.marketCap,
      price: row.price,
      // The blend ranks; ret and vol are averaged across the same two windows
      // so all three numbers on a row describe one thing.
      composite: metrics.composite,
      score12_1: metrics.score12_1,
      score6_1: metrics.score6_1,
      annRet: (metrics.annRet12_1 + metrics.annRet6_1) / 2,
      annVol: (metrics.vol12 + metrics.vol6) / 2,
      medianDollarVolume: metrics.medianDollarVolume,
      corr: corr.b64,
      corrExact: corr.exact,
      lastDate: metrics.lastDate,
    };
  };

  const scored = await pooled(candidates, CONCURRENCY, measure);

  if (failed.length) {
    const retry = failed.splice(0, failed.length);
    console.log(`Retrying ${retry.length} failed fetches at low concurrency…`);
    scored.push(...(await pooled(retry, 3, measure)));
    if (failed.length) console.warn(`  still failing: ${failed.map((r) => r.symbol).join(', ')}`);
  }

  const stocks = scored.filter(Boolean).sort((a, b) => b.composite - a.composite);
  stocks.forEach((s, i) => { s.rank = i + 1; });

  // Verify that the quantised vectors the page ships still reproduce the exact
  // correlations closely enough for a 0.70 flag to mean what it says.
  const err = quantisationError(stocks);
  console.log(`\nquantisation: max |Δρ| ${err.max.toFixed(5)}, mean ${err.mean.toFixed(6)} over ${err.n} pairs`);

  const asOf = stocks.reduce((m, s) => (s.lastDate > m ? s.lastDate : m), '');
  const sectors = new Map();
  for (const s of stocks) sectors.set(s.sector, (sectors.get(s.sector) ?? 0) + 1);

  const payload = {
    generatedAt: new Date().toISOString(),
    asOf,
    filter: {
      exchanges: ['NASDAQ', 'NYSE', 'AMEX'],
      minPrice: MIN_PRICE,
      minMedianDollarVolume: MIN_MEDIAN_DOLLAR_VOLUME,
      note: 'common stock only; preferreds, warrants, units and rights removed; one line per company (most liquid share class); foreign cross-listings excluded',
    },
    method: {
      score: 'mean of the 12-1 and 6-1 volatility-adjusted momentum scores; each = annualised log return over the window / annualised daily-return volatility over the same window',
      ret: 'mean of the two windows\' annualised log returns',
      vol: 'mean of the two windows\' annualised volatilities',
      correlation: `${WEEKS} weekly log returns, standardised; page correlation = dot product of two decoded vectors`,
    },
    sectors: [...sectors].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    stocks: stocks.map(({ corrExact, ...s }) => s),
  };

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/ranks.json', import.meta.url), JSON.stringify(payload, null, 1));

  console.log(`\n${stocks.length} tradeable names, as of ${asOf}`);
  for (const { name, count } of payload.sectors) console.log(`  ${String(count).padStart(4)}  ${name}`);
  console.log('\nTop 15:');
  for (const s of stocks.slice(0, 15)) {
    console.log(
      `  ${String(s.rank).padStart(4)}  ${s.symbol.padEnd(6)} ${s.composite.toFixed(2).padStart(6)}  ` +
      `ret ${(s.annRet * 100).toFixed(1).padStart(7)}%  vol ${(s.annVol * 100).toFixed(1).padStart(6)}%  ${s.name}`,
    );
  }
}

/** Samples random pairs and compares decoded-vector ρ against exact ρ. */
function quantisationError(stocks) {
  const decode = (b64) => {
    const buf = Buffer.from(b64, 'base64');
    const v = Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
    const mean = v.reduce((s, x) => s + x, 0) / v.length;
    const c = v.map((x) => x - mean);
    const norm = Math.sqrt(c.reduce((s, x) => s + x * x, 0));
    return c.map((x) => x / norm);
  };
  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);

  let max = 0, total = 0, n = 0;
  const step = Math.max(1, Math.floor(stocks.length / 60));
  for (let i = 0; i < stocks.length; i += step) {
    const qi = decode(stocks[i].corr);
    for (let j = i + 1; j < stocks.length; j += step) {
      const d = Math.abs(dot(qi, decode(stocks[j].corr)) - dot(stocks[i].corrExact, stocks[j].corrExact));
      max = Math.max(max, d);
      total += d;
      n++;
    }
  }
  return { max, mean: n ? total / n : 0, n };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

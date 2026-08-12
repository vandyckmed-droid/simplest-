// Builds data/etfs.json: the thematic ETF list, scored exactly like the stock
// universe.
//
//   node src/etf-build.js
//
// The maths is untouched — a fund has adjusted closes like anything else. What
// differs is selection: there is no screener step, because the list *is* the
// universe, and no market-cap floor, because a fund has assets rather than a
// capitalisation. Names come from the theme list rather than the fund's legal
// name: on this page SMH is "Semiconductors", not "VanEck Semiconductor ETF".

import { mkdir, writeFile } from 'node:fs/promises';
import { dailyAdjusted, pooled } from './fmp.js';
import { score } from './momentum.js';
import { ETF_THEMES, ETF_TICKERS, ETF_UNIVERSE } from './etf-universe.js';

const MIN_BARS = 253;
const STALE_DAYS = 10;
const CONCURRENCY = 8;

const isoDaysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

async function main() {
  const from = isoDaysAgo(430);
  const to = isoDaysAgo(0);
  console.log(`Scoring ${ETF_TICKERS.length} funds…`);

  const dropped = [];
  const failed = [];

  const measure = async (ticker) => {
    let bars;
    try {
      bars = await dailyAdjusted(ticker, from, to);
    } catch {
      failed.push(ticker);
      return null;
    }
    if (!Array.isArray(bars) || !bars.length) {
      dropped.push(`${ticker}: no history`);
      return null;
    }

    // A closed fund still quotes; what stops is the history. Check recency
    // before bar count, so a dead fund is reported as dead rather than short.
    const ageDays = Math.round((Date.parse(to) - Date.parse(bars[0].date)) / 864e5);
    if (ageDays > STALE_DAYS) {
      dropped.push(`${ticker}: stopped trading ${bars[0].date}`);
      return null;
    }
    if (bars.length < MIN_BARS) {
      dropped.push(`${ticker}: ${bars.length} bars`);
      return null;
    }

    const series = bars
      .map((b) => ({ date: b.date, close: b.adjClose, volume: b.volume }))
      .filter((b) => Number.isFinite(b.close) && b.close > 0)
      .reverse();

    const metrics = score(series);
    if (!metrics) { dropped.push(`${ticker}: unscoreable`); return null; }

    const entry = ETF_UNIVERSE.get(ticker);
    return {
      symbol: ticker,
      name: entry.label,
      theme: entry.themes[0],
      themes: entry.themes,
      composite: metrics.composite,
      score12_1: metrics.score12_1,
      score6_1: metrics.score6_1,
      annRet: (metrics.annRet12_1 + metrics.annRet6_1) / 2,
      annVol: (metrics.vol12 + metrics.vol6) / 2,
      annRet12_1: metrics.annRet12_1,
      annRet6_1: metrics.annRet6_1,
      vol12: metrics.vol12,
      vol6: metrics.vol6,
      medianDollarVolume: metrics.medianDollarVolume,
      lastDate: metrics.lastDate,
    };
  };

  let rows = await pooled(ETF_TICKERS, CONCURRENCY, measure);

  if (failed.length) {
    const retry = failed.splice(0, failed.length);
    console.log(`Retrying ${retry.length} failed fetches…`);
    rows.push(...(await pooled(retry, 3, measure)));
    if (failed.length) console.warn(`  still failing: ${failed.join(', ')}`);
  }

  const funds = rows.filter(Boolean).sort((a, b) => b.composite - a.composite);
  funds.forEach((f, i) => { f.rank = i + 1; });

  // Theme order follows the source list, not fund count — the list's ordering is
  // itself editorial, running broad sectors first and niches last.
  const present = new Set(funds.map((f) => f.theme));
  const themes = ETF_THEMES.map((t) => t.group).filter((g) => present.has(g));

  const asOf = funds.reduce((m, f) => (f.lastDate > m ? f.lastDate : m), '');
  const payload = {
    generatedAt: new Date().toISOString(),
    asOf,
    method: {
      score: 'identical to the stock universe: mean of the 12-1 and 6-1 volatility-adjusted momentum scores',
      universe: 'curated thematic ETF list from src/etf-universe.js; no screener step and no market-cap floor',
    },
    themes,
    funds,
  };

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/etfs.json', import.meta.url), JSON.stringify(payload, null, 1));

  console.log(`\n${funds.length}/${ETF_TICKERS.length} funds scored, as of ${asOf}`);
  if (dropped.length) console.log(`dropped:\n  ${dropped.join('\n  ')}`);
  console.log('\nTop 12:');
  for (const f of funds.slice(0, 12)) {
    console.log(
      `  ${String(f.rank).padStart(3)}  ${f.symbol.padEnd(5)} ${f.composite.toFixed(2).padStart(6)}  ` +
      `vol ${(f.annVol * 100).toFixed(0).padStart(3)}%  ${f.name}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

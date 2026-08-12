// Checks the staged ETF universe against FMP: does every ticker still resolve,
// does it have enough history to score, and how thin is it?
//
//   node src/etf-check.js
//
// Worth re-running before wiring the list into the page. Thematic ETFs close
// and get renamed more often than stocks do, and a dead fund still returns a
// quote — it is the *history* that stops moving.

import { dailyAdjusted, pooled } from './fmp.js';
import { ETF_THEMES, ETF_TICKERS, ETF_UNIVERSE } from './etf-universe.js';

const MIN_BARS = 253; // a full 12-1 window
const STALE_DAYS = 10; // last bar older than this and the fund has stopped trading

const isoDaysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString().slice(0, 10);

async function main() {
  const listings = ETF_THEMES.reduce((n, t) => n + t.funds.length, 0);
  console.log(`${ETF_THEMES.length} themes · ${ETF_TICKERS.length} unique funds · ${listings} listings`);

  const from = isoDaysAgo(430);
  const to = isoDaysAgo(0);
  const dead = [];
  const stale = [];
  const short = [];

  const rows = await pooled(ETF_TICKERS, 8, async (ticker) => {
    let bars;
    try {
      bars = await dailyAdjusted(ticker, from, to);
    } catch {
      dead.push(ticker);
      return null;
    }
    if (!Array.isArray(bars) || !bars.length) { dead.push(ticker); return null; }

    const last = bars[0].date;
    const ageDays = Math.round((Date.parse(to) - Date.parse(last)) / 864e5);
    if (ageDays > STALE_DAYS) { stale.push(`${ticker} (last bar ${last})`); return null; }
    if (bars.length < MIN_BARS) { short.push(`${ticker} (${bars.length} bars)`); return null; }

    const dv = bars.slice(0, 63).map((b) => b.adjClose * b.volume).filter((v) => v > 0).sort((a, b) => a - b);
    return { ticker, bars: bars.length, medDV: dv.length ? dv[dv.length >> 1] : 0 };
  });

  const ok = rows.filter(Boolean).sort((a, b) => a.medDV - b.medDV);
  console.log(`\nscoreable: ${ok.length}/${ETF_TICKERS.length}`);
  if (dead.length) console.log(`  no history: ${dead.join(', ')}`);
  if (stale.length) console.log(`  stopped trading: ${stale.join(', ')}`);
  if (short.length) console.log(`  too short: ${short.join(', ')}`);

  const fmt = (v) => (v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(1)}M`);
  console.log('\nmedian daily dollar volume, thinnest first:');
  for (const r of ok.slice(0, 10)) console.log(`  ${r.ticker.padEnd(5)} ${fmt(r.medDV)}`);
  console.log('  …');
  for (const r of ok.slice(-3)) console.log(`  ${r.ticker.padEnd(5)} ${fmt(r.medDV)}`);

  // The stock side requires $25M. Applied here it would delete most of the
  // thematic list, so ETF mode needs its own floor — this is what it costs.
  for (const floor of [1e6, 5e6, 25e6]) {
    console.log(`  ≥ ${fmt(floor)}: ${ok.filter((r) => r.medDV >= floor).length} funds survive`);
  }

  const multi = [...ETF_UNIVERSE].filter(([, v]) => v.themes.length > 1);
  console.log(`\n${multi.length} funds appear under more than one theme`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

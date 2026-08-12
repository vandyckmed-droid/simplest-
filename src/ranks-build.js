// Builds data/ranks.json: every tradeable US name that clears a liquidity
// floor, ranked on the blend of volatility-adjusted 12-1 and 6-1 momentum.
//
//   node src/ranks-build.js

import { mkdir, writeFile } from 'node:fs/promises';
import { dailyAdjusted, pooled, screener } from './fmp.js';
import { blendAt, DEFAULT_SKIP, score } from './momentum.js';
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

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
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

    return {
      symbol: row.symbol,
      name: row.companyName,
      sector: row.sector ?? null,
      industry: row.industry ?? null,
      exchange: row.exchangeShortName,
      marketCap: row.marketCap,
      price: row.price,
      // Annualised return and volatility at every skip x lookback, flattened
      // skip-major; the page derives score and blend from them.
      rt: metrics.rt,
      vl: metrics.vl,
      // The stored rank is the conventional definition — 12-1 and 6-1 blended,
      // one month skipped. The page re-ranks positionally when either edge of
      // the window moves.
      composite: blendAt(metrics.rt, metrics.vl, DEFAULT_SKIP),
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
      score: 'annualised log return over a window / annualised daily-return volatility over the same window; the blend is the mean of the 12-month and 6-month scores',
      windows: 'rt and vl are flattened skip-major over skips [0, 10, 21] trading days x lookbacks [252, 126]; index = skip * 2 + lookback',
      composite: 'the blend at the conventional one-month skip, which the stored rank sorts on',
    },
    sectors: [...sectors].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    stocks,
  };

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(new URL('../data/ranks.json', import.meta.url), JSON.stringify(payload, null, 1));

  console.log(`\n${stocks.length} tradeable names, as of ${asOf}`);
  for (const { name, count } of payload.sectors) console.log(`  ${String(count).padStart(4)}  ${name}`);
  // blended over the two lookbacks at the conventional skip, for the log only
  const meanAt = (a) => (a[DEFAULT_SKIP * 2] + a[DEFAULT_SKIP * 2 + 1]) / 2;
  console.log('\nTop 15:');
  for (const s of stocks.slice(0, 15)) {
    console.log(
      `  ${String(s.rank).padStart(4)}  ${s.symbol.padEnd(6)} ${s.composite.toFixed(2).padStart(6)}  ` +
      `ret ${(meanAt(s.rt) * 100).toFixed(1).padStart(7)}%  vol ${(meanAt(s.vl) * 100).toFixed(1).padStart(6)}%  ${s.name}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Builds data/screener.json: ~25 large, liquid US names per industry group,
// ranked by the average of their volatility-adjusted 12-1 and 6-1 momentum.
//
//   node src/build.js

import { mkdir, writeFile } from 'node:fs/promises';
import { dailyAdjusted, pooled, screener } from './fmp.js';
import { groupFor, INDUSTRY_GROUPS, SHORT_LABELS } from './industry-groups.js';
import { rolling, score } from './momentum.js';

const TARGET_PER_GROUP = 25;
const CANDIDATES_PER_GROUP = 34; // headroom for names that fail history/liquidity
const MIN_MARKET_CAP = 2e9;
const MIN_SCREENER_VOLUME = 200_000;
const MIN_MEDIAN_DOLLAR_VOLUME = 15e6;
const MIN_BARS = 253; // a full 12-1 window (252 bars) plus the 21-day skip
const CONCURRENCY = 16;

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log('Fetching universe…');
  const universe = await screener({
    marketCapMoreThan: MIN_MARKET_CAP,
    volumeMoreThan: MIN_SCREENER_VOLUME,
  });
  console.log(`  ${universe.length} US common stocks above $${MIN_MARKET_CAP / 1e9}B`);

  const unmapped = new Map();
  const buckets = new Map(Object.keys(INDUSTRY_GROUPS).map((g) => [g, []]));
  for (const row of universe) {
    const group = groupFor(row.industry);
    if (!group) {
      unmapped.set(row.industry, (unmapped.get(row.industry) ?? 0) + 1);
      continue;
    }
    buckets.get(group).push(row);
  }
  if (unmapped.size) {
    console.log('  unmapped industries:', [...unmapped].map(([i, n]) => `${i} (${n})`).join(', '));
  }

  // Largest names first: "large and liquid" is a selection rule, not part of
  // the ranking, so market cap only decides who gets measured.
  const candidates = [];
  for (const [group, rows] of buckets) {
    rows.sort((a, b) => b.marketCap - a.marketCap);
    for (const row of rows.slice(0, CANDIDATES_PER_GROUP)) candidates.push({ ...row, group });
  }
  console.log(`Fetching ${candidates.length} price histories…`);

  const from = isoDaysAgo(430); // ~14 months of calendar days -> ~290 bars
  const to = new Date().toISOString().slice(0, 10);

  let done = 0;
  const scored = await pooled(candidates, CONCURRENCY, async (row) => {
    let bars;
    try {
      bars = await dailyAdjusted(row.symbol, from, to);
    } catch (err) {
      console.warn(`  ${row.symbol}: ${err.message}`);
      return null;
    } finally {
      if (++done % 100 === 0) console.log(`  ${done}/${candidates.length}`);
    }
    if (!Array.isArray(bars) || bars.length < MIN_BARS) return null;

    // FMP returns newest first; the momentum math wants oldest first.
    const series = bars
      .map((b) => ({ date: b.date, close: b.adjClose, volume: b.volume }))
      .filter((b) => Number.isFinite(b.close) && b.close > 0)
      .reverse();

    const metrics = score(series);
    if (!metrics) return null;

    return {
      symbol: row.symbol,
      name: row.companyName,
      group: row.group,
      industry: row.industry,
      sector: row.sector,
      exchange: row.exchangeShortName,
      marketCap: row.marketCap,
      price: row.price,
      beta: row.beta,
      ...metrics,
      roll: rolling(series),
    };
  });

  const byGroup = new Map(Object.keys(INDUSTRY_GROUPS).map((g) => [g, []]));
  for (const s of scored) {
    if (!s) continue;
    if (s.medianDollarVolume < MIN_MEDIAN_DOLLAR_VOLUME) continue;
    byGroup.get(s.group).push(s);
  }

  const stocks = [];
  const groups = [];
  for (const [group, members] of byGroup) {
    // Trim back to the target on market cap, then rank on the signal.
    members.sort((a, b) => b.marketCap - a.marketCap);
    const kept = members.slice(0, TARGET_PER_GROUP);
    kept.sort((a, b) => b.composite - a.composite);
    kept.forEach((s, i) => {
      s.groupRank = i + 1;
      s.groupSize = kept.length;
    });
    groups.push({ name: group, short: SHORT_LABELS[group] ?? group, count: kept.length });
    stocks.push(...kept);
  }

  stocks.sort((a, b) => b.composite - a.composite);
  stocks.forEach((s, i) => {
    s.rank = i + 1;
  });

  const asOf = stocks.reduce((m, s) => (s.lastDate > m ? s.lastDate : m), '');
  const payload = {
    generatedAt: new Date().toISOString(),
    asOf,
    method: {
      horizons: ['12-1', '6-1'],
      skipDays: 21,
      formula: 'annualised log return over the window / annualised daily-return volatility over the same window; composite = mean of the two horizons',
      rolling: 'trailing 63-session window, no skip, sampled every 5 sessions; annualised return and the same return divided by annualised volatility of that window',
      selection: `top ${TARGET_PER_GROUP} US names per industry group by market cap, requiring >= $${MIN_MEDIAN_DOLLAR_VOLUME / 1e6}M median daily dollar volume over the last 63 sessions`,
      source: 'Financial Modeling Prep (split- and dividend-adjusted daily closes)',
    },
    groups: groups.sort((a, b) => a.name.localeCompare(b.name)),
    stocks,
  };

  await mkdir(new URL('../data/', import.meta.url), { recursive: true });
  await writeFile(
    new URL('../data/screener.json', import.meta.url),
    JSON.stringify(payload, null, 1),
  );

  console.log(`\n${stocks.length} stocks across ${groups.length} industry groups, as of ${asOf}`);
  for (const g of payload.groups) console.log(`  ${String(g.count).padStart(2)}  ${g.name}`);
  console.log('\nTop 15 overall:');
  for (const s of stocks.slice(0, 15)) {
    console.log(
      `  ${String(s.rank).padStart(3)}  ${s.symbol.padEnd(6)} ${s.composite.toFixed(2).padStart(6)}  ` +
      `12-1 ${(s.ret12_1 * 100).toFixed(1).padStart(6)}%  6-1 ${(s.ret6_1 * 100).toFixed(1).padStart(6)}%  ${s.group}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Builds `src/data/market.json` (and the logo files beside it) from real
 * adjusted end-of-day prices.
 *
 * Run with `npm run data`. Needs API_KEY in the environment; the key never
 * reaches the output. The output is deterministic: the same inputs always
 * produce byte-identical JSON, so later phases can calculate against it.
 *
 *   node tools/build-market-data.mjs [--refresh]
 *
 * `--refresh` ignores the on-disk cache and re-downloads everything.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cached } from './cache.mjs';
import { dailyAdjusted, logo, profile } from './fmp.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA_OUT = join(ROOT, 'src', 'data', 'market.json');
const LOGO_DIR = join(ROOT, 'src', 'assets', 'logos');

/**
 * Ten liquid US large caps. The 500-name universe is a later phase; this list
 * is deliberately fixed so the app has a stable set to render.
 */
const UNIVERSE = [
  'NVDA', 'AVGO', 'CEG', 'LLY', 'ANET',
  'COST', 'GE', 'AXP', 'WMT', 'JPM',
];

/** Enough history for the 2Y window with room to spare. */
const HISTORY_FROM = '2023-08-01';

const force = process.argv.includes('--refresh');
const today = new Date().toISOString().slice(0, 10);

const round = (value, places) => Number(value.toFixed(places));

/**
 * Turns raw provider bars into ascending, validated series.
 * Returns the series plus anything suspicious that was dropped.
 */
function normalizeBars(symbol, rows) {
  const problems = [];
  const seen = new Set();
  const clean = [];

  for (const row of rows) {
    const { date, adjClose } = row ?? {};
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      problems.push(`${symbol}: bar with an unusable date (${JSON.stringify(date)})`);
      continue;
    }
    if (typeof adjClose !== 'number' || !Number.isFinite(adjClose) || adjClose <= 0) {
      problems.push(`${symbol}: ${date} has no usable adjusted close`);
      continue;
    }
    if (seen.has(date)) {
      problems.push(`${symbol}: duplicate bar for ${date}`);
      continue;
    }
    seen.add(date);
    clean.push({ date, close: round(adjClose, 4) });
  }

  // Oldest first, so slicing a window is always "the tail".
  clean.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  if (clean.length < 2) {
    throw new Error(`${symbol}: only ${clean.length} usable bars`);
  }

  return { clean, problems };
}

async function buildStock(symbol) {
  const [{ value: rawProfile }, { value: rawBars }] = await Promise.all([
    cached(`profile-${symbol}`, () => profile(symbol), { force }),
    cached(`eod-${symbol}-${today}`, () => dailyAdjusted(symbol, HISTORY_FROM, today), { force }),
  ]);

  const { clean, problems } = normalizeBars(symbol, rawBars);

  const last = clean[clean.length - 1];
  const previous = clean[clean.length - 2];
  const name = typeof rawProfile.companyName === 'string' && rawProfile.companyName.trim()
    ? rawProfile.companyName.trim()
    : symbol;

  if (!name || name === symbol) {
    problems.push(`${symbol}: no company name from the provider`);
  }

  const marketCap = Number.isFinite(rawProfile.marketCap) ? rawProfile.marketCap : 0;
  if (!marketCap) problems.push(`${symbol}: no market cap from the provider`);

  // Cross-check our day change against the provider's own figure.
  const dayChange = last.close / previous.close - 1;
  if (Number.isFinite(rawProfile.changePercentage)) {
    const theirs = rawProfile.changePercentage / 100;
    if (Math.abs(theirs - dayChange) > 0.005) {
      problems.push(
        `${symbol}: day change from adjusted closes (${(dayChange * 100).toFixed(2)}%) ` +
        `differs from the provider quote (${(theirs * 100).toFixed(2)}%)`,
      );
    }
  }

  return {
    stock: {
      symbol,
      name,
      price: last.close,
      dayChange: round(dayChange, 6),
      marketCap,
      asOf: last.date,
      history: {
        dates: clean.map((bar) => bar.date),
        closes: clean.map((bar) => bar.close),
      },
    },
    problems,
  };
}

async function saveLogo(symbol) {
  const { value } = await cached(
    `logo-${symbol}`,
    async () => {
      const bytes = await logo(symbol);
      return bytes ? bytes.toString('base64') : null;
    },
    { ttlHours: 24 * 30, force },
  );
  if (!value) return false;
  await mkdir(LOGO_DIR, { recursive: true });
  await writeFile(join(LOGO_DIR, `${symbol}.png`), Buffer.from(value, 'base64'));
  return true;
}

async function main() {
  const problems = [];
  const stocks = [];

  for (const symbol of UNIVERSE) {
    try {
      const result = await buildStock(symbol);
      stocks.push(result.stock);
      problems.push(...result.problems);
    } catch (error) {
      // One bad symbol must not sink the build; the rest of the app still works.
      problems.push(`${symbol}: SKIPPED — ${error.message}`);
    }
  }

  if (stocks.length === 0) throw new Error('no symbols could be built');

  const logos = [];
  for (const stock of stocks) {
    try {
      if (await saveLogo(stock.symbol)) logos.push(stock.symbol);
      else problems.push(`${stock.symbol}: no logo available, falling back to a monogram`);
    } catch (error) {
      problems.push(`${stock.symbol}: logo download failed — ${error.message}`);
    }
  }

  // Ranked by market cap. Momentum is a later phase; this keeps the order
  // stable and meaningful in the meantime.
  stocks.sort((a, b) => b.marketCap - a.marketCap);
  stocks.forEach((stock, i) => {
    stock.rank = i + 1;
  });

  const asOf = stocks.map((s) => s.asOf).sort().at(-1);
  const stale = stocks.filter((s) => s.asOf !== asOf);
  for (const s of stale) {
    problems.push(`${s.symbol}: last close is ${s.asOf}, behind the newest ${asOf}`);
  }

  const dataset = {
    source: 'Financial Modeling Prep — dividend- and split-adjusted daily closes',
    asOf,
    stocks: stocks.map((stock) => ({
      rank: stock.rank,
      symbol: stock.symbol,
      name: stock.name,
      price: stock.price,
      dayChange: stock.dayChange,
      marketCap: stock.marketCap,
      asOf: stock.asOf,
      history: stock.history,
    })),
  };

  await mkdir(dirname(DATA_OUT), { recursive: true });
  await writeFile(DATA_OUT, `${JSON.stringify(dataset, null, 2)}\n`);

  console.log(`Wrote ${stocks.length} stocks to src/data/market.json (as of ${asOf})`);
  console.log(`Logos: ${logos.length}/${stocks.length}`);
  for (const stock of dataset.stocks) {
    console.log(
      `  ${String(stock.rank).padStart(2)} ${stock.symbol.padEnd(5)} ` +
      `${String(stock.history.closes.length).padStart(4)} bars  ` +
      `${stock.history.dates[0]}..${stock.asOf}  ` +
      `$${stock.price.toFixed(2)}  ${(stock.dayChange * 100).toFixed(2)}%  ${stock.name}`,
    );
  }
  if (problems.length) {
    console.log(`\nData-quality notes (${problems.length}):`);
    for (const problem of problems) console.log(`  - ${problem}`);
  } else {
    console.log('\nNo data-quality problems found.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

/**
 * Builds `src/data/market.json` (and the logo files beside it) from real
 * adjusted end-of-day prices.
 *
 * Run with `npm run data`. Needs API_KEY in the environment; the key never
 * reaches the output. The output is deterministic: the same inputs always
 * produce byte-identical JSON, so the app can calculate against it.
 *
 *   node tools/build-market-data.mjs [--refresh]
 *
 * `--refresh` ignores the on-disk cache and re-downloads everything.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cached } from './cache.mjs';
import { logo, profile } from './fmp.mjs';
import { selectUniverse } from './universe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA_OUT = join(ROOT, 'src', 'data', 'market.json');
const LOGO_DIR = join(ROOT, 'src', 'assets', 'logos');

/** How many names the universe holds. */
const UNIVERSE_SIZE = 50;

/** Enough history for the 2Y graph with room to spare. */
const HISTORY_FROM = '2023-08-01';

/**
 * Sessions kept per stock. The longest window drawn is 2Y (504 sessions) and
 * the longest measured is 12–1 (253), so this covers both with margin while
 * keeping the dataset small enough to ship.
 */
const KEEP_SESSIONS = 540;

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

  if (clean.length < 2) throw new Error(`only ${clean.length} usable bars`);
  return { clean: clean.slice(-KEEP_SESSIONS), problems };
}

async function buildStock(entry) {
  const { clean, problems } = normalizeBars(entry.symbol, entry.bars);

  const last = clean[clean.length - 1];
  const previous = clean[clean.length - 2];
  const name =
    typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : entry.symbol;
  if (name === entry.symbol) problems.push(`${entry.symbol}: no company name from the provider`);

  const dayChange = last.close / previous.close - 1;

  // Cross-check our day change against the provider's own quote.
  try {
    const { value: rawProfile } = await cached(
      `profile-${entry.symbol}`,
      () => profile(entry.symbol),
      { force },
    );
    if (Number.isFinite(rawProfile.changePercentage)) {
      const theirs = rawProfile.changePercentage / 100;
      if (Math.abs(theirs - dayChange) > 0.005) {
        problems.push(
          `${entry.symbol}: day change from adjusted closes (${(dayChange * 100).toFixed(2)}%) ` +
            `differs from the provider quote (${(theirs * 100).toFixed(2)}%)`,
        );
      }
    }
  } catch (error) {
    problems.push(`${entry.symbol}: could not cross-check the day change — ${error.message}`);
  }

  return {
    stock: {
      symbol: entry.symbol,
      name,
      exchange: entry.exchange,
      price: last.close,
      dayChange: round(dayChange, 6),
      marketCap: entry.marketCap,
      medianDollarVolume: Math.round(entry.medianDollarVolume),
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

/**
 * Pretty-printed, except the price series, which stay on one line each. A
 * dataset with a line per price is unreadable in a diff and needlessly large.
 */
function serialize(dataset) {
  const stocks = dataset.stocks.map((stock) => {
    const { history, ...rest } = stock;
    const head = JSON.stringify(rest, null, 2)
      .split('\n')
      .map((line, i) => (i === 0 ? '    {' : `    ${line}`))
      .slice(0, -1)
      .join('\n');
    return (
      `${head},\n` +
      `      "history": {\n` +
      `        "dates": ${JSON.stringify(history.dates)},\n` +
      `        "closes": ${JSON.stringify(history.closes)}\n` +
      `      }\n    }`
    );
  });
  return (
    `{\n  "source": ${JSON.stringify(dataset.source)},\n` +
    `  "asOf": ${JSON.stringify(dataset.asOf)},\n` +
    `  "selection": ${JSON.stringify(dataset.selection)},\n` +
    `  "stocks": [\n${stocks.join(',\n')}\n  ]\n}\n`
  );
}

async function main() {
  const problems = [];

  const { chosen, notes } = await selectUniverse({
    size: UNIVERSE_SIZE,
    from: HISTORY_FROM,
    to: today,
    force,
  });
  problems.push(...notes);

  const stocks = [];
  for (const entry of chosen) {
    try {
      const result = await buildStock(entry);
      stocks.push(result.stock);
      problems.push(...result.problems);
    } catch (error) {
      // One bad symbol must not sink the build; the rest of the app still works.
      problems.push(`${entry.symbol}: SKIPPED — ${error.message}`);
    }
  }

  if (stocks.length === 0) throw new Error('no symbols could be built');

  let logoCount = 0;
  for (const stock of stocks) {
    try {
      if (await saveLogo(stock.symbol)) logoCount += 1;
      else problems.push(`${stock.symbol}: no logo available, falling back to a monogram`);
    } catch (error) {
      problems.push(`${stock.symbol}: logo download failed — ${error.message}`);
    }
  }

  // A stable, data-only order. Ranking is a calculation the app performs
  // from these closes, so no rank is stored here.
  stocks.sort((a, b) => (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0));

  const asOf = stocks.map((s) => s.asOf).sort().at(-1);
  for (const s of stocks.filter((s) => s.asOf !== asOf)) {
    problems.push(`${s.symbol}: last close is ${s.asOf}, behind the newest ${asOf}`);
  }

  const dataset = {
    source: 'Financial Modeling Prep — dividend- and split-adjusted daily closes',
    asOf,
    selection:
      'The 50 most liquid US common stocks on NYSE, Nasdaq or NYSE American, ' +
      'by median daily dollar volume over the last 63 sessions.',
    stocks,
  };

  await mkdir(dirname(DATA_OUT), { recursive: true });
  await writeFile(DATA_OUT, serialize(dataset));

  console.log(`Wrote ${stocks.length} stocks to src/data/market.json (as of ${asOf})`);
  console.log(`Logos: ${logoCount}/${stocks.length}`);
  const byLiquidity = [...stocks].sort((a, b) => b.medianDollarVolume - a.medianDollarVolume);
  for (const [i, stock] of byLiquidity.entries()) {
    console.log(
      `  ${String(i + 1).padStart(2)} ${stock.symbol.padEnd(6)} ${stock.exchange.padEnd(6)} ` +
        `${String(stock.history.closes.length).padStart(4)} bars  ` +
        `$${(stock.medianDollarVolume / 1e6).toFixed(0).padStart(6)}M/day  ${stock.name}`,
    );
  }
  if (problems.length) {
    console.log(`\nBuild notes (${problems.length}):`);
    for (const problem of problems) console.log(`  - ${problem}`);
  } else {
    console.log('\nNo data-quality problems found.');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

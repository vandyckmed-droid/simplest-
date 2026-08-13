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

import { mkdir, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cached } from './cache.mjs';
import { logo } from './fmp.mjs';
import { selectUniverse } from './universe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const DATA_OUT = join(ROOT, 'src', 'data', 'market.json');
const LOGO_DIR = join(ROOT, 'src', 'assets', 'logos');

/** How many names the universe holds. */
const UNIVERSE_SIZE = 100;

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
 * The session the whole field is measured to.
 *
 * A cross-sectional rank only means something if every name is measured to
 * the same date, and the provider can be a session ahead on some symbols —
 * a partly-filled current day, or simply a series fetched later in the day
 * than the rest. The date most of the field last traded is the honest common
 * ground: anything after it is trimmed, so no stock is ranked on an extra
 * day its neighbours have not had.
 */
function commonAsOf(entries) {
  const counts = new Map();
  for (const entry of entries) {
    const dates = (entry.bars ?? [])
      .map((bar) => bar?.date)
      .filter((date) => typeof date === 'string');
    if (!dates.length) continue;
    const newest = dates.reduce((a, b) => (a > b ? a : b));
    counts.set(newest, (counts.get(newest) ?? 0) + 1);
  }
  let best = null;
  for (const [date, count] of counts) {
    // Most of the field wins; a tie goes to the later session.
    if (!best || count > best.count || (count === best.count && date > best.date)) {
      best = { date, count };
    }
  }
  return best?.date ?? null;
}

/**
 * Turns raw provider bars into ascending, validated series, ending no later
 * than `asOf`. Returns the series plus anything suspicious that was dropped.
 */
function normalizeBars(symbol, rows, asOf) {
  const problems = [];
  const seen = new Set();
  const clean = [];
  let trimmed = 0;

  for (const row of rows) {
    const { date, adjClose } = row ?? {};
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      problems.push(`${symbol}: bar with an unusable date (${JSON.stringify(date)})`);
      continue;
    }
    if (asOf && date > asOf) {
      trimmed += 1;
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
  return { clean: clean.slice(-KEEP_SESSIONS), problems, trimmed };
}

async function buildStock(entry, asOf) {
  const { clean, problems, trimmed } = normalizeBars(entry.symbol, entry.bars, asOf);
  if (trimmed) {
    problems.push(
      `${entry.symbol}: ${trimmed} bar(s) after ${asOf} trimmed, to measure the field to one date`,
    );
  }

  const last = clean[clean.length - 1];
  const previous = clean[clean.length - 2];
  const name =
    typeof entry.name === 'string' && entry.name.trim() ? entry.name.trim() : entry.symbol;
  if (name === entry.symbol) problems.push(`${entry.symbol}: no company name from the provider`);

  const dayChange = last.close / previous.close - 1;

  // There was a cross-check here against the provider's own quote. It has
  // been removed, because it could not be made to mean anything.
  //
  // That quote is live — it describes whichever session is trading now —
  // while this dataset deliberately ends at the last session the whole field
  // completed. The two are usually different days, so the comparison fired on
  // perfectly good data: at a hundred names it flagged a third of the
  // universe. Gating on the quoted price matching our last close does not
  // rescue it either, since a stock trading near yesterday's close passes the
  // gate while still being quoted a day later.
  //
  // What it was guarding against — a series the provider adjusted wrongly —
  // is not detectable this way. A missed split looks like a large single-day
  // move, and this universe contains genuine ones up to +59%, so no threshold
  // separates the two. The figures that do get checked are checked properly:
  // `npm test` re-derives every stock's momentum from these closes, and the
  // browser suite asserts the day change on screen against price ÷ previous
  // close. A check that cries wolf is worse than no check, because it teaches
  // you to skim the build notes.

  return {
    stock: {
      symbol: entry.symbol,
      name,
      exchange: entry.exchange,
      country: entry.country,
      isAdr: entry.isAdr,
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

/**
 * Deletes the marks of companies that are no longer in the universe. The
 * folder is generated, so it should hold what the dataset holds and nothing
 * else — a stale logo is a name the app dropped, still shipping in the bundle.
 */
async function pruneLogos(symbols) {
  const keep = new Set(symbols.map((symbol) => `${symbol}.png`));
  let removed = 0;
  let files;
  try {
    files = await readdir(LOGO_DIR);
  } catch {
    return [];
  }
  const gone = [];
  for (const file of files) {
    if (!file.endsWith('.png') || keep.has(file)) continue;
    await unlink(join(LOGO_DIR, file));
    gone.push(file.replace(/\.png$/, ''));
    removed += 1;
  }
  return removed ? [`removed ${removed} logo(s) for names no longer held: ${gone.join(', ')}`] : [];
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

  // Fix the field's date before building anything, so every series ends on
  // the same session and no stock is ranked on a day its neighbours lack.
  const fieldAsOf = commonAsOf(chosen);

  const stocks = [];
  for (const entry of chosen) {
    try {
      const result = await buildStock(entry, fieldAsOf);
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
  problems.push(...(await pruneLogos(stocks.map((s) => s.symbol))));

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
      'The 100 most liquid US-listed companies — domestic common stocks on ' +
      'NYSE, Nasdaq or NYSE American, and ADRs on NYSE or Nasdaq — by median ' +
      'daily dollar volume over the last 63 sessions, one listing per company.',
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
        `${(stock.isAdr ? `ADR ${stock.country}` : 'common').padEnd(7)} ` +
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

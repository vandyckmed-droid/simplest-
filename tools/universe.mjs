/**
 * Chooses the universe by liquidity, deterministically.
 *
 * The rule, in order:
 *
 *  1. Ask the provider's screener for actively traded US common stocks on
 *     NYSE, Nasdaq or NYSE American, above a floor on market cap and price.
 *     ETFs and funds are excluded by the screener; anything that is not
 *     ordinary common stock is excluded by its symbol.
 *  2. Keep the most active `POOL_SIZE` of those by the screener's snapshot of
 *     dollar volume. This only bounds how much history is downloaded.
 *  3. For each candidate, measure liquidity properly from our own adjusted
 *     EOD data: the median daily dollar volume over the last
 *     `LIQUIDITY_DAYS` sessions. A median rather than a mean, so one frantic
 *     day cannot buy a name its way in.
 *  4. Drop anything without enough history to carry the 12–1 signal.
 *  5. Keep the top `size` by that median. Ties break on symbol, so the same
 *     data always produces the same list in the same order.
 */

import { cached } from './cache.mjs';
import { dailyAdjusted, screener } from './fmp.mjs';

/** How many candidates to pull history for before ranking properly. */
const POOL_SIZE = 120;
/** Sessions the liquidity median is taken over — about a quarter. */
const LIQUIDITY_DAYS = 63;
/** 12–1 needs day −252, so 253 bars; ask for a little more. */
const MIN_BARS = 260;
/** Floors that keep penny stocks and microcaps out of the pool. */
const MIN_MARKET_CAP = 2_000_000_000;
const MIN_PRICE = 5;

const ALLOWED_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'AMEX']);

/**
 * Ordinary common stock only: plain tickers, plus the A/B class shares that
 * are still common stock. This is what keeps preferreds (BAC-PB), warrants,
 * rights and units out — they all carry a suffix this will not match.
 */
const COMMON_STOCK_SYMBOL = /^[A-Z]{1,5}(-[AB])?$/;

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Runs `worker` over `items` with a bounded number of requests in flight. */
async function pooled(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= items.length) return;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function selectUniverse({ size, from, to, force = false }) {
  const notes = [];

  const { value: rows } = await cached(
    `screener-${to}`,
    () =>
      screener({
        exchange: [...ALLOWED_EXCHANGES].join(','),
        marketCapMoreThan: MIN_MARKET_CAP,
        priceMoreThan: MIN_PRICE,
        limit: 3000,
      }),
    { force },
  );

  const eligible = rows.filter(
    (row) =>
      row &&
      typeof row.symbol === 'string' &&
      COMMON_STOCK_SYMBOL.test(row.symbol) &&
      ALLOWED_EXCHANGES.has(row.exchangeShortName) &&
      row.country === 'US' &&
      row.isEtf === false &&
      row.isFund === false &&
      row.isActivelyTrading === true &&
      Number.isFinite(row.price) &&
      row.price >= MIN_PRICE &&
      Number.isFinite(row.marketCap) &&
      row.marketCap >= MIN_MARKET_CAP,
  );
  notes.push(`screener returned ${rows.length} rows; ${eligible.length} are eligible common stocks`);

  const pool = eligible
    .map((row) => ({ ...row, snapshotDollarVolume: row.price * (row.volume ?? 0) }))
    .sort(
      (a, b) =>
        b.snapshotDollarVolume - a.snapshotDollarVolume ||
        (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0),
    )
    .slice(0, POOL_SIZE);

  const measured = await pooled(pool, 6, async (candidate) => {
    try {
      const { value: bars } = await cached(
        `eod-${candidate.symbol}-${to}`,
        () => dailyAdjusted(candidate.symbol, from, to),
        { force },
      );
      if (!Array.isArray(bars) || bars.length < MIN_BARS) {
        return { candidate, skip: `only ${bars?.length ?? 0} bars` };
      }
      // The provider returns newest first, so the recent window is the head.
      const recent = bars.slice(0, LIQUIDITY_DAYS).filter(
        (bar) => Number.isFinite(bar?.adjClose) && Number.isFinite(bar?.volume),
      );
      if (recent.length < LIQUIDITY_DAYS) {
        return { candidate, skip: `only ${recent.length} usable recent sessions` };
      }
      return {
        candidate,
        bars,
        medianDollarVolume: median(recent.map((bar) => bar.adjClose * bar.volume)),
      };
    } catch (error) {
      return { candidate, skip: error.message };
    }
  });

  for (const entry of measured) {
    if (entry.skip) notes.push(`${entry.candidate.symbol}: not eligible — ${entry.skip}`);
  }

  const ranked = measured
    .filter((entry) => !entry.skip)
    .sort(
      (a, b) =>
        b.medianDollarVolume - a.medianDollarVolume ||
        (a.candidate.symbol < b.candidate.symbol ? -1 : 1),
    );

  if (ranked.length < size) {
    notes.push(`only ${ranked.length} candidates survived, fewer than the ${size} wanted`);
  }

  const chosen = ranked.slice(0, size);
  const cutoff = chosen.at(-1)?.medianDollarVolume ?? 0;
  notes.push(
    `ranked ${ranked.length} candidates by median dollar volume over ${LIQUIDITY_DAYS} sessions; ` +
      `the ${chosen.length}th takes $${(cutoff / 1e6).toFixed(0)}M a day`,
  );

  return {
    chosen: chosen.map((entry) => ({
      symbol: entry.candidate.symbol,
      name: entry.candidate.companyName,
      marketCap: entry.candidate.marketCap,
      exchange: entry.candidate.exchangeShortName,
      medianDollarVolume: entry.medianDollarVolume,
      bars: entry.bars,
    })),
    notes,
  };
}

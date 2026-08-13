/**
 * Chooses the universe by liquidity, deterministically.
 *
 * The rule, in order:
 *
 *  1. Ask the provider's screener for actively traded stocks on NYSE, Nasdaq
 *     or NYSE American, above a floor on market cap and price. ETFs and funds
 *     are excluded by the screener; anything that is not ordinary common
 *     stock or an ADR is excluded by its symbol.
 *  2. Keep the most active `POOL_SIZE` of those by the screener's snapshot of
 *     dollar volume. This only bounds how much history is downloaded.
 *  3. Settle each candidate's security type from its profile, which is the
 *     only place the provider says whether a listing is a depositary receipt.
 *     Domestic common stock and ADRs are eligible; nothing else is.
 *  4. For each survivor, measure liquidity properly from our own adjusted
 *     EOD data: the median daily dollar volume over the last
 *     `LIQUIDITY_DAYS` sessions. A median rather than a mean, so one frantic
 *     day cannot buy a name its way in.
 *  5. Drop anything without enough history to carry the 12–1 signal.
 *  6. Keep one listing per company, the most liquid one, so a second share
 *     class is never a second position in the same business.
 *  7. Keep the top `size` by that median. Ties break on symbol, so the same
 *     data always produces the same list in the same order.
 *
 * ADRs compete on exactly these terms. There is no quota for them and no
 * adjustment to how they are measured.
 */

import { cached } from './cache.mjs';
import { dailyAdjusted, profile, screener } from './fmp.mjs';

/**
 * How many candidates to pull history for before ranking properly. This only
 * bounds the download; it has to be comfortably wider than the universe,
 * because the pool is ordered on a single day's dollar volume while the
 * selection is made on a quarter's median, and because eligibility and
 * de-duplication both thin it before the cut.
 */
const POOL_SIZE = 300;
/** Sessions the liquidity median is taken over — about a quarter. */
const LIQUIDITY_DAYS = 63;
/** 12–1 needs day −252, so 253 bars; ask for a little more. */
const MIN_BARS = 260;
/** Floors that keep penny stocks and microcaps out of the pool. */
const MIN_MARKET_CAP = 2_000_000_000;
const MIN_PRICE = 5;

/**
 * Rows to ask the screener for. The provider answers larger asks with a 503,
 * and this already covers every listing above the market-cap floor with room
 * to spare — `selectUniverse` says so in its notes if that ever stops being
 * true.
 */
const SCREENER_LIMIT = 2500;

/** Where an ordinary domestic common stock may be listed. */
const DOMESTIC_EXCHANGES = new Set(['NYSE', 'NASDAQ', 'AMEX']);

/**
 * Where an ADR may be listed: the two main boards only. NYSE American is not
 * one of them, and OTC never reaches this code — the screener is asked for
 * these exchanges and nothing else, so an over-the-counter receipt is not a
 * candidate in the first place.
 */
const ADR_EXCHANGES = new Set(['NYSE', 'NASDAQ']);

/** Every exchange a candidate may come from, of either type. */
const ALLOWED_EXCHANGES = new Set([...DOMESTIC_EXCHANGES, ...ADR_EXCHANGES]);

/**
 * Ordinary common stock and ADRs both trade under plain tickers; the A/B
 * class shares that are still common stock carry a suffix. This is what keeps
 * preferreds (BAC-PB), warrants, rights and units out — they all carry a
 * suffix this will not match.
 */
const COMMON_STOCK_SYMBOL = /^[A-Z]{1,5}(-[AB])?$/;

/** Legal forms and class wording that do not distinguish one company from another. */
const NAME_NOISE =
  /\b(american depositary (shares|receipts)|class [a-z]|common stock|ordinary shares|incorporated|corporation|holdings?|company|group|limited|inc|corp|ltd|plc|nv|sa|se|ag|as)\b/g;

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

/**
 * What makes two listings the same economic exposure.
 *
 * The registrant's CIK, when the provider has one: share classes of a company
 * share it, so Alphabet's A and C shares answer to one key rather than two.
 * Failing that, the company name with its legal form stripped — a weaker test,
 * so every merge it makes is reported.
 */
export function companyKey(entry) {
  const cik = String(entry.profile?.cik ?? '').replace(/^0+/, '').trim();
  if (cik) return { key: `cik:${cik}`, byName: false };
  const name = String(entry.candidate.companyName ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(NAME_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { key: name ? `name:${name}` : `symbol:${entry.candidate.symbol}`, byName: true };
}

/**
 * Decides what a listing is from its profile, which is the only place the
 * provider distinguishes a depositary receipt from ordinary shares.
 *
 * A foreign company listed directly rather than through a receipt — Shopify,
 * Linde, Accenture — is neither a domestic common stock nor an ADR, so it is
 * not eligible. That is a narrower rule than "anything on a US exchange", and
 * a deliberate one: the security type admitted here is the ADR.
 */
export function classify(candidate, prof) {
  const exchange = candidate.exchangeShortName;
  if (prof.isAdr === true) {
    if (!ADR_EXCHANGES.has(exchange)) {
      return { skip: `ADR listed on ${exchange}, not NYSE or Nasdaq` };
    }
    return { isAdr: true, country: prof.country ?? candidate.country ?? null };
  }
  if (candidate.country !== 'US') {
    return {
      skip: `${candidate.country ?? 'foreign'} listing that is not an ADR`,
    };
  }
  if (!DOMESTIC_EXCHANGES.has(exchange)) {
    return { skip: `listed on ${exchange}` };
  }
  return { isAdr: false, country: 'US' };
}

export async function selectUniverse({ size, from, to, force = false }) {
  const notes = [];

  const { value: rows } = await cached(
    `screener-all-${to}`,
    () =>
      screener({
        exchange: [...ALLOWED_EXCHANGES].join(','),
        marketCapMoreThan: MIN_MARKET_CAP,
        priceMoreThan: MIN_PRICE,
        limit: SCREENER_LIMIT,
        // Every country: an ADR's issuer is foreign by definition.
        country: undefined,
      }),
    { force },
  );
  if (rows.length >= SCREENER_LIMIT) {
    notes.push(`screener returned ${rows.length} rows, its limit — the field may be truncated`);
  }

  const listed = rows.filter(
    (row) =>
      row &&
      typeof row.symbol === 'string' &&
      COMMON_STOCK_SYMBOL.test(row.symbol) &&
      ALLOWED_EXCHANGES.has(row.exchangeShortName) &&
      row.isEtf === false &&
      row.isFund === false &&
      row.isActivelyTrading === true &&
      Number.isFinite(row.price) &&
      row.price >= MIN_PRICE &&
      Number.isFinite(row.marketCap) &&
      row.marketCap >= MIN_MARKET_CAP,
  );
  const domestic = listed.filter((row) => row.country === 'US').length;
  notes.push(
    `screener returned ${rows.length} rows; ${listed.length} are listed candidates ` +
      `(${domestic} US, ${listed.length - domestic} foreign issuers)`,
  );

  const pool = listed
    .map((row) => ({ ...row, snapshotDollarVolume: row.price * (row.volume ?? 0) }))
    .sort(
      (a, b) =>
        b.snapshotDollarVolume - a.snapshotDollarVolume ||
        (a.symbol < b.symbol ? -1 : a.symbol > b.symbol ? 1 : 0),
    )
    .slice(0, POOL_SIZE);

  const measured = await pooled(pool, 6, async (candidate) => {
    try {
      // The security type, and the identity used to spot a second listing of
      // the same company, both come from the profile.
      const { value: prof } = await cached(
        `profile-${candidate.symbol}`,
        () => profile(candidate.symbol),
        { force },
      );
      const type = classify(candidate, prof);
      if (type.skip) return { candidate, skip: type.skip };

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
        profile: prof,
        isAdr: type.isAdr,
        country: type.country,
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

  // One listing per company. Walking the ranked list keeps the most liquid of
  // any pair, and every drop is reported so the merge can be checked.
  const seen = new Map();
  const unique = [];
  for (const entry of ranked) {
    const { key, byName } = companyKey(entry);
    const kept = seen.get(key);
    if (kept) {
      notes.push(
        `${entry.candidate.symbol}: dropped as a second listing of ${kept.candidate.symbol} ` +
          `(${kept.candidate.companyName}), matched on ${byName ? 'company name' : 'CIK'}`,
      );
      continue;
    }
    seen.set(key, entry);
    unique.push(entry);
  }

  if (unique.length < size) {
    notes.push(`only ${unique.length} candidates survived, fewer than the ${size} wanted`);
  }

  const chosen = unique.slice(0, size);
  const cutoff = chosen.at(-1)?.medianDollarVolume ?? 0;
  const adrs = chosen.filter((entry) => entry.isAdr);
  notes.push(
    `ranked ${unique.length} companies by median dollar volume over ${LIQUIDITY_DAYS} sessions; ` +
      `the ${chosen.length}th takes $${(cutoff / 1e6).toFixed(0)}M a day`,
  );
  notes.push(
    adrs.length
      ? `${adrs.length} of the ${chosen.length} are ADRs: ${adrs.map((e) => e.candidate.symbol).join(', ')}`
      : 'no ADR cleared the liquidity cutoff',
  );

  return {
    chosen: chosen.map((entry) => ({
      symbol: entry.candidate.symbol,
      name: entry.candidate.companyName,
      marketCap: entry.candidate.marketCap,
      exchange: entry.candidate.exchangeShortName,
      country: entry.country,
      isAdr: entry.isAdr,
      medianDollarVolume: entry.medianDollarVolume,
      bars: entry.bars,
    })),
    notes,
  };
}

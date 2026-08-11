// Thin client for the Financial Modeling Prep "stable" API.
// The v3 endpoints are retired for keys issued after 2025-08-31, so everything
// here targets /stable.

const BASE = 'https://financialmodelingprep.com/stable';

const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  throw new Error('API_KEY (Financial Modeling Prep) is not set in the environment');
}

async function get(path, params) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set('apikey', API_KEY);

  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleep(500 * 2 ** attempt);
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' } });
      if (res.status === 429) {
        lastError = new Error('rate limited');
        continue;
      }
      if (!res.ok) throw new Error(`${res.status} ${res.statusText} on ${path}`);
      const body = await res.json();
      if (body && body['Error Message']) throw new Error(body['Error Message']);
      return body;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Every actively traded US common stock above the given market cap. */
export function screener({ marketCapMoreThan, volumeMoreThan, limit = 5000 }) {
  return get('company-screener', {
    marketCapMoreThan,
    volumeMoreThan,
    isEtf: false,
    isFund: false,
    isActivelyTrading: true,
    country: 'US',
    limit,
  });
}

/** Split- and dividend-adjusted daily bars, oldest last (as FMP returns them). */
export function dailyAdjusted(symbol, from, to) {
  return get('historical-price-eod/dividend-adjusted', { symbol, from, to });
}

/** Runs `worker` over `items` with a bounded number of in-flight requests. */
export async function pooled(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

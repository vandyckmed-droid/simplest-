/**
 * Thin client for the Financial Modeling Prep "stable" API.
 *
 * This module only ever runs at build time, in Node. The API key is read from
 * the environment and never reaches the browser, the repository, or the
 * generated dataset.
 */

const BASE = 'https://financialmodelingprep.com/stable';
const LOGO_BASE = 'https://images.financialmodelingprep.com/symbol';

function apiKey() {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error(
      'API_KEY is not set. The market-data build needs it in the environment.',
    );
  }
  return key;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Strips the key from anything we might print or throw. */
function safeUrl(url) {
  const copy = new URL(url);
  copy.searchParams.delete('apikey');
  return `${copy.pathname}${copy.search}`;
}

async function get(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('apikey', apiKey());

  let lastError;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (attempt > 0) await sleep(500 * 2 ** attempt);
    try {
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (response.status === 429) {
        lastError = new Error(`rate limited on ${safeUrl(url)}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText} on ${safeUrl(url)}`);
      }
      const body = await response.json();
      if (body && body['Error Message']) throw new Error(String(body['Error Message']));
      return body;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/** Company name, market cap, exchange. */
export async function profile(symbol) {
  const rows = await get('profile', { symbol });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`no profile returned for ${symbol}`);
  }
  return rows[0];
}

/** Split- and dividend-adjusted daily bars. FMP returns newest first. */
export async function dailyAdjusted(symbol, from, to) {
  const rows = await get('historical-price-eod/dividend-adjusted', { symbol, from, to });
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`no price history returned for ${symbol}`);
  }
  return rows;
}

/** The company mark, or null when one isn't available. */
export async function logo(symbol) {
  const response = await fetch(`${LOGO_BASE}/${symbol}.png`);
  if (!response.ok) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  // A near-empty response means a placeholder rather than a real mark.
  return bytes.length > 512 ? bytes : null;
}

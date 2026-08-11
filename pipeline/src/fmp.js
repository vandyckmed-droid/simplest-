// Financial Modeling Prep client.
//
// Everything the pipeline pulls goes through here so that retries, throttling,
// on-disk caching and key redaction are handled in exactly one place.

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = 'https://financialmodelingprep.com/stable';
const CACHE_DIR = path.resolve('.cache/fmp');

const KEY = process.env.API_KEY;
if (!KEY) {
  throw new Error('API_KEY is not set in the environment.');
}

// Never let the key reach a log line, an error message or a committed file.
export function redact(text) {
  return String(text).split(KEY).join('<API_KEY>');
}

function cachePath(url) {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 32);
  return path.join(CACHE_DIR, `${hash}.json`);
}

async function readCache(url, maxAgeMs) {
  if (!maxAgeMs) return null;
  try {
    const file = cachePath(url);
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs > maxAgeMs) return null;
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return null;
  }
}

async function writeCache(url, data) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cachePath(url), JSON.stringify(data), 'utf8');
  } catch {
    // A cache write failure must never fail the build.
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a /stable endpoint.
 *
 * Returns { ok, data, status, error }. Callers decide whether a failure is
 * fatal - most are not, because the pipeline is built to degrade rather than
 * abort when one symbol misbehaves.
 */
export async function fmpGet(endpoint, params = {}, opts = {}) {
  const { retries = 3, cacheMs = 12 * 60 * 60 * 1000, timeoutMs = 45000 } = opts;

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  }
  const cacheKey = `${endpoint}?${qs.toString()}`;
  qs.set('apikey', KEY);
  const url = `${BASE}/${endpoint}?${qs.toString()}`;

  const cached = await readCache(cacheKey, cacheMs);
  if (cached) return { ok: true, data: cached, status: 200, cached: true };

  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
      const text = await res.text();

      if (res.status === 429) {
        // Rate limited - back off and try again.
        await sleep(1500 * (attempt + 1));
        lastError = 'rate limited';
        continue;
      }
      if (!res.ok) {
        // 402/403 mean the plan does not cover this symbol or endpoint. Retrying
        // will not change that, so surface it immediately.
        return { ok: false, status: res.status, error: redact(text).slice(0, 240) };
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return { ok: false, status: res.status, error: 'response was not valid JSON' };
      }

      // FMP signals some errors with a 200 and an error body.
      if (data && !Array.isArray(data) && data['Error Message']) {
        return { ok: false, status: 200, error: redact(data['Error Message']).slice(0, 240) };
      }

      await writeCache(cacheKey, data);
      return { ok: true, data, status: res.status, cached: false };
    } catch (err) {
      lastError = redact(err.message);
      await sleep(600 * (attempt + 1));
    }
  }
  return { ok: false, status: 0, error: lastError || 'request failed' };
}

// Runs tasks with a bounded number in flight. Keeps the build fast without
// tripping the provider's rate limit.
export async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
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

export const LOGO_URL = (symbol) => `https://images.financialmodelingprep.com/symbol/${symbol}.png`;

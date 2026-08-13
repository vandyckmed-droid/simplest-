/**
 * A small on-disk cache of raw API responses.
 *
 * Re-running the build reuses whatever is still fresh, so the same history is
 * not downloaded again and again. The cache holds raw provider payloads only —
 * never the key — and lives outside the repository.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = join(HERE, '..', 'data-cache');

const DEFAULT_TTL_HOURS = 12;

function pathFor(key) {
  // Keys are composed by this repo, but keep the filename tame regardless.
  return join(CACHE_DIR, `${key.replace(/[^A-Za-z0-9._-]/g, '_')}.json`);
}

/**
 * Returns the cached value for `key`, or calls `fetcher` and stores the result.
 * `force` bypasses whatever is stored.
 */
export async function cached(key, fetcher, { ttlHours = DEFAULT_TTL_HOURS, force = false } = {}) {
  const file = pathFor(key);

  if (!force) {
    try {
      const raw = await readFile(file, 'utf8');
      const entry = JSON.parse(raw);
      const ageMs = Date.now() - Date.parse(entry.fetchedAt);
      if (Number.isFinite(ageMs) && ageMs < ttlHours * 3600_000) {
        return { value: entry.value, hit: true };
      }
    } catch {
      // No usable cache entry: fall through and fetch.
    }
  }

  const value = await fetcher();
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(file, JSON.stringify({ fetchedAt: new Date().toISOString(), value }));
  return { value, hit: false };
}

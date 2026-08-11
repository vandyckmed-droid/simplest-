// Equal-weight sector series - simple synthetic sector ETFs built from the
// universe itself, so a sector's performance always reflects the same names the
// rankings are drawn from.

import { isNum } from './stats.js';

/**
 * Builds a daily equal-weight, daily-rebalanced index.
 *
 * Each day the index earns the average of that day's returns across every
 * constituent that actually traded on both that day and the day before. A name
 * with a short history simply joins the average once its data begins, instead of
 * dragging the whole series down to the shortest member.
 *
 * closesBySymbol: { SYM: number[] } all aligned to `dates`
 * Returns { dates, values, membership } with values rebased to 100.
 */
export function equalWeightSeries(dates, closesBySymbol, symbols) {
  const members = symbols.filter((s) => Array.isArray(closesBySymbol[s]));
  const n = dates.length;
  const values = new Array(n).fill(null);
  const membership = new Array(n).fill(0);
  if (members.length === 0 || n === 0) return { dates, values, membership, members };

  let level = 100;
  values[0] = level;
  membership[0] = members.filter((s) => isNum(closesBySymbol[s][0])).length;

  for (let t = 1; t < n; t += 1) {
    let sum = 0;
    let count = 0;
    for (const s of members) {
      const series = closesBySymbol[s];
      const prev = series[t - 1];
      const cur = series[t];
      if (isNum(prev) && isNum(cur) && prev > 0) {
        sum += cur / prev - 1;
        count += 1;
      }
    }
    // No constituent traded (holiday or a data gap): carry the level forward
    // rather than inventing a return.
    const avg = count > 0 ? sum / count : 0;
    level *= 1 + avg;
    values[t] = level;
    membership[t] = count;
  }

  return { dates, values, membership, members };
}

// Daily simple returns from a level series, for feeding the risk engine.
export function seriesReturns(values) {
  const out = [];
  for (let i = 1; i < values.length; i += 1) {
    const prev = values[i - 1];
    const cur = values[i];
    out.push(isNum(prev) && isNum(cur) && prev > 0 ? cur / prev - 1 : null);
  }
  return out;
}

// Groups universe rows by a field, keeping only groups at or above `minCount`.
// Used to decide which industries are large enough to be treated as their own
// ranked bucket (requirement: tag sufficiently large industries).
export function groupsAtLeast(rows, field, minCount) {
  const counts = new Map();
  for (const r of rows) {
    const v = r[field];
    if (!v) continue;
    counts.set(v, (counts.get(v) || 0) + 1);
  }
  const out = [];
  for (const [name, count] of counts) if (count >= minCount) out.push({ name, count });
  out.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return out;
}

// Basic statistics helpers. Pure functions, no dependencies.
// Shared by the offline pipeline and the phone app so both produce identical numbers.

export const TRADING_DAYS_PER_YEAR = 252;
export const TRADING_DAYS_PER_MONTH = 21;

export function isNum(x) {
  return typeof x === 'number' && Number.isFinite(x);
}

export function mean(xs) {
  const v = xs.filter(isNum);
  if (v.length === 0) return null;
  let s = 0;
  for (const x of v) s += x;
  return s / v.length;
}

// Sample standard deviation (n-1). Needs at least 2 observations.
export function stdev(xs) {
  const v = xs.filter(isNum);
  if (v.length < 2) return null;
  const m = mean(v);
  let s = 0;
  for (const x of v) s += (x - m) * (x - m);
  return Math.sqrt(s / (v.length - 1));
}

export function median(xs) {
  const v = xs.filter(isNum).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

// z = (x - mean) / stdev over the supplied peer group.
// Returns null when the peer group is too small or degenerate, so callers can
// show "not enough peers" instead of a fake 0.
export function zScore(x, peers) {
  if (!isNum(x)) return null;
  const m = mean(peers);
  const sd = stdev(peers);
  if (!isNum(m) || !isNum(sd) || sd === 0) return null;
  return (x - m) / sd;
}

// Standard competition ranking, 1 = best: ties share the lowest rank number
// and the ranks after a tie are skipped (values 9, 9, 5 rank 1, 1, 3).
export function rankDescending(items, valueOf) {
  const scored = items
    .map((item, i) => ({ item, i, v: valueOf(item) }))
    .filter((s) => isNum(s.v));
  scored.sort((a, b) => b.v - a.v);
  const ranks = new Map();
  let lastValue = null;
  let lastRank = 0;
  scored.forEach((s, idx) => {
    const rank = s.v === lastValue ? lastRank : idx + 1;
    lastValue = s.v;
    lastRank = rank;
    ranks.set(s.i, rank);
  });
  return { ranks, count: scored.length };
}

// Percentile of a value within a population, 0..100 (100 = highest value).
export function percentileOf(x, population) {
  if (!isNum(x)) return null;
  const v = population.filter(isNum);
  if (v.length === 0) return null;
  let below = 0;
  for (const p of v) if (p < x) below += 1;
  return (below / v.length) * 100;
}

export function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  const xs = [];
  const ys = [];
  for (let i = 0; i < n; i += 1) {
    if (isNum(a[i]) && isNum(b[i])) {
      xs.push(a[i]);
      ys.push(b[i]);
    }
  }
  if (xs.length < 3) return null;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i += 1) {
    const a1 = xs[i] - mx;
    const b1 = ys[i] - my;
    num += a1 * b1;
    dx += a1 * a1;
    dy += b1 * b1;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

export function clamp(x, lo, hi) {
  return Math.min(hi, Math.max(lo, x));
}

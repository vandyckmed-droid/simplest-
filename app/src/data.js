// Dataset access layer.
//
// The screens never touch the raw JSON. They ask this module for a row, a
// series, or a set of daily returns, which keeps the interface independent of
// how the pipeline happens to store things.

import core from '../data/core.json';
import prices from '../data/prices.json';
import { isNum } from './analytics/stats';

export const manifest = core.manifest;
export const benchmark = core.benchmark;
export const dates = core.dates;
export const universe = core.universe;
export const sectorSeries = core.sectors;
export const industrySeries = core.industries;
export const macro = core.macro;

export const bySymbol = new Map(universe.map((r) => [r.symbol, r]));
export const sectorByKey = new Map(sectorSeries.map((s) => [s.key, s]));
export const industryByKey = new Map(industrySeries.map((s) => [s.key, s]));

export const SECTORS = sectorSeries.map((s) => s.key);

// Industries that cleared the tagging threshold, plus the ones that did not, so
// the UI can be honest about which groups are ranked and which are only labels.
export const TAGGED_INDUSTRIES = new Set(industrySeries.map((s) => s.key));

export function industryIsTagged(name) {
  return TAGGED_INDUSTRIES.has(name);
}

export function closesFor(symbol) {
  return prices.closes[symbol] || null;
}

// Daily simple returns aligned to `dates`. Index 0 is null (no prior day), and
// any day without a print on either side is null rather than zero.
const returnsCache = new Map();
export function returnsFor(symbol) {
  if (returnsCache.has(symbol)) return returnsCache.get(symbol);
  const closes = closesFor(symbol);
  if (!closes) {
    returnsCache.set(symbol, null);
    return null;
  }
  const out = new Array(closes.length).fill(null);
  for (let i = 1; i < closes.length; i += 1) {
    const a = closes[i - 1];
    const b = closes[i];
    out[i] = isNum(a) && isNum(b) && a > 0 ? b / a - 1 : null;
  }
  returnsCache.set(symbol, out);
  return out;
}

export function returnsMapFor(symbols) {
  const map = {};
  for (const s of symbols) {
    const r = returnsFor(s);
    if (r) map[s] = r;
  }
  return map;
}

export function atrPctMapFor(symbols) {
  const map = {};
  for (const s of symbols) {
    const row = bySymbol.get(s);
    if (row && isNum(row.atrPct)) map[s] = row.atrPct;
  }
  return map;
}

// A named series for anything chartable: a stock, a sector index, an industry
// index, the benchmark, or a macro asset.
export function seriesFor(ref) {
  if (!ref) return null;
  if (ref.kind === 'stock') {
    const closes = closesFor(ref.key);
    const row = bySymbol.get(ref.key);
    return closes ? { label: ref.key, sublabel: row ? row.name : '', values: closes, dates } : null;
  }
  if (ref.kind === 'sector') {
    const s = sectorByKey.get(ref.key);
    return s ? { label: s.label, sublabel: `${s.constituents} names, equal weight`, values: s.values, dates } : null;
  }
  if (ref.kind === 'industry') {
    const s = industryByKey.get(ref.key);
    return s ? { label: s.label, sublabel: `${s.constituents} names, equal weight`, values: s.values, dates } : null;
  }
  if (ref.kind === 'benchmark') {
    const closes = closesFor(benchmark.symbol);
    return closes ? { label: benchmark.symbol, sublabel: benchmark.label, values: closes, dates } : null;
  }
  if (ref.kind === 'macro') {
    const m = macro.find((x) => x.key === ref.key);
    return m ? { label: m.label, sublabel: m.sublabel, values: m.values, dates } : null;
  }
  return null;
}

export function refLabel(ref) {
  const s = seriesFor(ref);
  return s ? s.label : ref && ref.key ? ref.key : '';
}

// Benchmarks a stock can be measured against: its own sector, its industry when
// that industry is ranked, and the market.
export function benchmarksFor(symbol) {
  const row = bySymbol.get(symbol);
  const out = [{ kind: 'benchmark', key: benchmark.symbol, label: `${benchmark.symbol} · ${benchmark.label}` }];
  if (!row) return out;
  if (sectorByKey.has(row.sector)) out.push({ kind: 'sector', key: row.sector, label: `${row.sector} (equal weight)` });
  if (row.industry && industryByKey.has(row.industry)) {
    out.push({ kind: 'industry', key: row.industry, label: `${row.industry} (equal weight)` });
  }
  return out;
}

// Case-insensitive search over symbol, company name, sector and industry.
// Exact symbol matches rank first, then symbol prefixes, then name matches.
export function search(query, limit = 40) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const scored = [];
  for (const r of universe) {
    const sym = r.symbol.toLowerCase();
    const name = (r.name || '').toLowerCase();
    let score = null;
    if (sym === q) score = 0;
    else if (sym.startsWith(q)) score = 1;
    else if (name.startsWith(q)) score = 2;
    else if (sym.includes(q)) score = 3;
    else if (name.includes(q)) score = 4;
    else if ((r.industry || '').toLowerCase().includes(q)) score = 5;
    else if ((r.sector || '').toLowerCase().includes(q)) score = 6;
    if (score !== null) scored.push({ row: r, score });
  }
  scored.sort((a, b) => a.score - b.score || (b.row.marketCap || 0) - (a.row.marketCap || 0));
  return scored.slice(0, limit).map((s) => s.row);
}

// Industries present in the universe, with their size and whether they are
// ranked as a group.
export function industriesInSector(sector) {
  const counts = new Map();
  for (const r of universe) {
    if (sector && r.sector !== sector) continue;
    if (!r.industry) continue;
    counts.set(r.industry, (counts.get(r.industry) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, tagged: TAGGED_INDUSTRIES.has(name) }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export function membersOfSector(sector) {
  return universe.filter((r) => r.sector === sector);
}

export function membersOfIndustry(industry) {
  return universe.filter((r) => r.industry === industry);
}

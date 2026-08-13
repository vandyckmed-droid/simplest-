// Inlines data/etfs.json — plus the hand-mapped holdings and the k-medoids
// grouping — into src/etfs-template.html and writes dist/etfs.html.
//
//   node src/etfs-render.js
//
// The funds get their own page rather than a toggle on the stock list. Eighty-
// nine names fit on one screen, which the stock universe never will, and that
// changes what the page can be: a board with the whole universe on it, grouped
// by how the funds actually move together.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { clusters, decodeVector } from './cluster.js';
import { VECTOR_WINDOW } from './momentum.js';
import { ETF_HOLDINGS } from './etf-holdings.js';

const KS = [5, 8, 10];
const REFERENCE_K = 8; // the run the colour slots are anchored to
const round = (v, dp) => (Number.isFinite(v) ? Number(v.toFixed(dp)) : null);

const etfs = JSON.parse(await readFile(new URL('../data/etfs.json', import.meta.url), 'utf8'));
const stocks = JSON.parse(await readFile(new URL('../data/ranks.json', import.meta.url), 'utf8'));

const funds = etfs.funds.filter((f) => f.corr);
if (funds.length !== etfs.funds.length) {
  console.warn(`  ${etfs.funds.length - funds.length} fund(s) without a return vector, dropped`);
}

// ---------- grouping ----------
const grouping = clusters(funds.map((f) => decodeVector(f.corr, VECTOR_WINDOW)), KS, REFERENCE_K);

// Which group each fund lands in, at each k — the page reads this per row, so
// it ships as a lookup rather than a search through the member lists.
const memberOf = Object.fromEntries(KS.map((k) => {
  const at = new Int32Array(funds.length);
  grouping[k].groups.forEach((g, gi) => { for (const i of g.members) at[i] = gi; });
  return [k, at];
}));

// ---------- holdings look-through ----------
// A holding is worth showing with its own momentum, so the page can put the
// fund's score beside the score of what it actually owns. Rank comes from the
// full stock universe and depends on the window, so all nine combinations are
// precomputed here rather than shipping 1,500 rows to rank against.
const stockRow = new Map(stocks.stocks.map((s, i) => [s.symbol, i]));

const scoreAt = (s, metric, skip) => {
  const base = skip * 2;
  if (metric === 1) return s.rt[base] / s.vl[base];
  if (metric === 2) return s.rt[base + 1] / s.vl[base + 1];
  return (s.rt[base] / s.vl[base] + s.rt[base + 1] / s.vl[base + 1]) / 2;
};

const stockRanks = [];
for (let metric = 0; metric < 3; metric++) {
  for (let skip = 0; skip < 3; skip++) {
    const order = stocks.stocks.map((_, i) => i)
      .sort((a, b) => scoreAt(stocks.stocks[b], metric, skip) - scoreAt(stocks.stocks[a], metric, skip));
    const rank = new Int32Array(stocks.stocks.length);
    order.forEach((idx, i) => { rank[idx] = i + 1; });
    stockRanks.push(rank);
  }
}

const holdingsFor = (symbol) => {
  const entry = ETF_HOLDINGS[symbol];
  if (!entry) return undefined;
  return entry.holdings.map(([sym, wt, note]) => {
    const at = stockRow.get(sym);
    // A miss is a fact about the fund's book, so it is carried and marked
    // rather than dropped; the note says what is known about why.
    if (at === undefined) return [sym, wt, note ?? 'not in the stock universe'];
    const s = stocks.stocks[at];
    return [
      sym, wt, s.name,
      s.rt.map((v) => round(v, 3)),
      s.vl.map((v) => round(v, 3)),
      stockRanks.map((r) => r[at]),
    ];
  });
};

for (const symbol of Object.keys(ETF_HOLDINGS)) {
  if (!funds.some((f) => f.symbol === symbol)) console.warn(`  holdings listed for ${symbol}, which is not a scored fund`);
}

// ---------- payload ----------
const themeIndex = new Map(etfs.themes.map((name, i) => [name, i]));

const compact = {
  asOf: etfs.asOf,
  stocksAsOf: stocks.asOf,
  themes: etfs.themes,
  ks: KS,
  referenceK: REFERENCE_K,
  funds: funds.map((f, i) => ({
    y: f.symbol,
    n: f.name, // the theme label, not the fund's legal name
    t: themeIndex.get(f.theme) ?? 0,
    rt: f.rt.map((v) => round(v, 3)),
    vl: f.vl.map((v) => round(v, 3)),
    c: f.corr,
    g: KS.map((k) => memberOf[k][i]),
    h: holdingsFor(f.symbol),
  })),
  groups: Object.fromEntries(KS.map((k) => [k, {
    sil: round(grouping[k].sil, 4),
    cost: round(grouping[k].cost, 2),
    groups: grouping[k].groups.map((g) => ({
      slot: g.slot,
      n: g.members.length,
      rho: round(g.rho, 3),
      medoid: g.medoid,
    })),
  }])),
};

const template = await readFile(new URL('etfs-template.html', import.meta.url), 'utf8');

// `</script` inside a string literal would close the host script element early.
const json = JSON.stringify(compact).replaceAll('</', '<\\/');
const html = template.replace('__DATA__', () => json);
if (html.includes('__DATA__')) throw new Error('the injection point was not replaced');

await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await writeFile(new URL('../dist/etfs.html', import.meta.url), html);

const mapped = compact.funds.filter((f) => f.h).length;
console.log(
  `dist/etfs.html — ${(html.length / 1024).toFixed(0)} KB · ${compact.funds.length} funds · ` +
  `${mapped} with holdings · groups at k=${KS.join('/')}`,
);
for (const k of KS) {
  console.log(
    `  k=${k}  silhouette ${compact.groups[k].sil.toFixed(3)}  ` +
    `sizes ${compact.groups[k].groups.map((g) => g.n).join(',')}`,
  );
}

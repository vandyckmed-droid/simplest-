// Verifies the built artifacts by recomputing headline numbers straight from the
// per-ticker price files, independently of the pipeline's own code path.
// Run: node pipeline/scripts/verify-build.mjs

import fs from 'node:fs';

const universe = JSON.parse(fs.readFileSync('data/universe.json', 'utf8'));
const sectorsFile = JSON.parse(fs.readFileSync('data/sectors.json', 'utf8'));
const macro = JSON.parse(fs.readFileSync('data/macro.json', 'utf8'));
const manifest = JSON.parse(fs.readFileSync('data/manifest.json', 'utf8'));
const core = JSON.parse(fs.readFileSync('app/data/core.json', 'utf8'));
const prices = JSON.parse(fs.readFileSync('app/data/prices.json', 'utf8'));

let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

console.log('\nshape');
ok('universe is 275 names', universe.length === 275, `${universe.length}`);
ok('25 per sector', new Set(Object.values(universe.reduce((a, r) => {
  a[r.sector] = (a[r.sector] || 0) + 1; return a;
}, {}))).size === 1);
ok('no duplicate symbols', new Set(universe.map((r) => r.symbol)).size === universe.length);
ok('every name has a sector', universe.every((r) => r.sector));
ok('trading date matches calendar end', manifest.tradingDate === manifest.calendar.last);
ok('calendar is ~251 days/year', Math.abs(manifest.calendar.days / 6 - 251) < 12, `${manifest.calendar.days}`);

console.log('\nrecomputing momentum from raw bars');
const sample = ['AAPL', 'NVDA', 'XOM', 'JPM', 'NEE'];
for (const sym of sample) {
  const row = universe.find((r) => r.symbol === sym);
  if (!row) { console.log(`  --   ${sym} not in universe, skipping`); continue; }
  const file = JSON.parse(fs.readFileSync(`data/prices/${sym}.json`, 'utf8'));
  const closes = file.bars.map((b) => b[4]);

  // 12-1 total return straight from the bar file.
  const p0 = closes[closes.length - 1 - 252];
  const p1 = closes[closes.length - 1 - 21];
  const totalRet = p1 / p0 - 1;
  ok(`${sym} 12-1 total return matches`, Math.abs(totalRet - row.components.h12_1.totalReturn) < 1e-4,
    `raw ${totalRet.toFixed(5)} vs stored ${row.components.h12_1.totalReturn}`);

  // Annualised return from that total return.
  const annRet = Math.pow(1 + totalRet, 252 / 231) - 1;
  ok(`${sym} annualised return matches`, Math.abs(annRet - row.components.h12_1.annReturn) < 1e-4);

  // Volatility over the identical window.
  const rets = [];
  for (let i = closes.length - 252; i <= closes.length - 1 - 21; i += 1) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const m = rets.reduce((s, x) => s + x, 0) / rets.length;
  const sd = Math.sqrt(rets.reduce((s, x) => s + (x - m) ** 2, 0) / (rets.length - 1));
  const annVol = sd * Math.sqrt(252);
  ok(`${sym} annualised vol matches`, Math.abs(annVol - row.components.h12_1.annVol) < 1e-4,
    `raw ${annVol.toFixed(5)} vs stored ${row.components.h12_1.annVol}`);
  ok(`${sym} score12 = annRet/annVol`, Math.abs(annRet / annVol - row.scores.score12) < 1e-3);
  ok(`${sym} vol window = return window`, rets.length === row.components.h12_1.observations,
    `${rets.length} vs ${row.components.h12_1.observations}`);
  ok(`${sym} blend is 50/50`, Math.abs(row.scores.blended - 0.5 * (row.scores.score12 + row.scores.score6)) < 1e-3);
  ok(`${sym} last close matches last bar`, Math.abs(row.lastClose - closes[closes.length - 1]) < 1e-3);
}

console.log('\nranks');
const withBlend = universe.filter((r) => r.scores.blended !== null);
const sortedBlend = withBlend.slice().sort((a, b) => b.scores.blended - a.scores.blended);
ok('global blended rank 1 is the top score',
  sortedBlend[0].ranks.blended.global === 1, `${sortedBlend[0].symbol} rank ${sortedBlend[0].ranks.blended.global}`);
ok('global rank count matches scored population',
  sortedBlend[0].ranks.blended.globalOf === withBlend.length);
ok('sector ranks stay within their sector', universe.every((r) =>
  r.ranks.blended.group === null || r.ranks.blended.group <= r.ranks.blended.groupOf));
ok('every sector has a rank-1 name',
  new Set(universe.filter((r) => r.ranks.blended.group === 1).map((r) => r.sector)).size === 11);
ok('sector z-scores roughly centre on zero', (() => {
  const zs = universe.map((r) => r.ranks.blended.groupZ).filter((z) => typeof z === 'number');
  const avg = zs.reduce((s, x) => s + x, 0) / zs.length;
  return Math.abs(avg) < 0.02;
})());
ok('global and sector ranks both present for all three measures', universe.every((r) =>
  ['score12', 'score6', 'blended'].every((k) => r.ranks[k] && 'global' in r.ranks[k] && 'group' in r.ranks[k])));

console.log('\nsector series');
const sectors = sectorsFile.sectors;
ok('11 sector series', sectors.length === 11);
ok('each has 25 constituents', sectors.every((s) => s.constituents === 25));
ok('series start at 100', sectors.every((s) => Math.abs(s.values[0] - 100) < 0.01));
ok('series ranked 1..11', new Set(sectors.map((s) => s.ranks.blended.rank)).size === 11);
ok('industries tagged', sectorsFile.industries.length >= 15, `${sectorsFile.industries.length}`);
ok('industry groups meet the threshold',
  sectorsFile.industries.every((i) => i.constituents >= manifest.config.industries.minCountToTag));

// Recompute one sector index by hand from constituent closes.
const target = sectors[0];
const dates = sectorsFile.dates;
const closesBySym = {};
for (const sym of target.members) {
  const f = JSON.parse(fs.readFileSync(`data/prices/${sym}.json`, 'utf8'));
  const map = new Map(f.bars.map((b) => [b[0], b[4]]));
  closesBySym[sym] = dates.map((d) => (map.has(d) ? map.get(d) : null));
}
let lvl = 100;
for (let t = 1; t < dates.length; t += 1) {
  let s = 0; let n = 0;
  for (const sym of target.members) {
    const a = closesBySym[sym][t - 1]; const b = closesBySym[sym][t];
    if (a && b) { s += b / a - 1; n += 1; }
  }
  lvl *= 1 + (n ? s / n : 0);
}
ok(`${target.label} index recomputes to the same level`,
  Math.abs(lvl - target.values[target.values.length - 1]) / lvl < 0.001,
  `hand ${lvl.toFixed(2)} vs stored ${target.values[target.values.length - 1]}`);

console.log('\nmacro');
ok('5 macro rows', macro.macro.length === 5, `${macro.macro.length}`);
ok('macro covers the asked-for assets',
  ['equities', 'bonds', 'oil', 'gold', 'crypto'].every((k) => macro.macro.some((m) => m.key === k)));
ok('macro sampled on equity days only', macro.dates.length === manifest.calendar.days);

console.log('\napp bundle');
ok('core universe matches data universe', core.universe.length === universe.length);
ok('bundle dates are the tail of the calendar',
  core.dates[core.dates.length - 1] === manifest.tradingDate);
ok('every universe symbol has bundled prices',
  universe.every((r) => Array.isArray(prices.closes[r.symbol])));
ok('bundled series length matches date axis',
  universe.every((r) => prices.closes[r.symbol].length === prices.dates.length));
ok('benchmark bundled', Array.isArray(prices.closes[core.benchmark.symbol]));
ok('bundle carries methodology', Boolean(core.manifest.methodology.volatility));
ok('bundle records data-quality counts',
  typeof core.manifest.dataQuality.excludedCount === 'number');

console.log('\ncoverage / data quality');
const shortHist = universe.filter((r) => r.coverage.length > 0);
console.log(`  ${shortHist.length} names flagged for short history: ${shortHist.map((r) => r.symbol).join(', ') || 'none'}`);
console.log(`  ${manifest.dataQuality.duplicatesDropped.length} duplicate listings folded away`);
console.log(`  ${manifest.dataQuality.excludedCount} candidates excluded by the liquidity gate`);
ok('flagged names have no score for the missing horizon',
  shortHist.every((r) => r.coverage.some((c) => c.includes('12-1')) ? r.scores.score12 === null : true));
ok('no name has a score without its components',
  universe.every((r) => (r.scores.score12 === null) === (r.components.h12_1 === null)));

console.log(`\n${fail === 0 ? 'ALL CHECKS PASSED' : fail + ' CHECKS FAILED'}\n`);
process.exit(fail === 0 ? 0 : 1);

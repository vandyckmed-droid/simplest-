// Integration test: exercises the app's own data layer and analytics against the
// real bundled dataset, the same way the screens do.
// Bundled through esbuild (see package.json check script) so JSON imports resolve.

import {
  universe,
  sectorSeries,
  industrySeries,
  macro,
  manifest,
  dates,
  bySymbol,
  closesFor,
  returnsFor,
  returnsMapFor,
  atrPctMapFor,
  seriesFor,
  benchmarksFor,
  search,
  industriesInSector,
  membersOfSector,
  membersOfIndustry,
  benchmark,
} from '../../app/src/data.js';

import { analysePortfolio, expectedMovement, describeRisk, findRedundant } from '../../app/src/analytics/portfolio.js';
import { rebase } from '../../app/src/analytics/returns.js';
import { explainMeasure } from '../../app/src/analytics/momentum.js';
import { isNum } from '../../app/src/analytics/stats.js';

let fail = 0;
const ok = (name, cond, detail = '') => {
  if (cond) console.log(`  ok   ${name}`);
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
};

console.log('\ndata layer');
ok('universe loaded', universe.length === 275, `${universe.length}`);
ok('dates axis matches bundle', dates.length > 400 && dates.length <= 520, `${dates.length}`);
ok('every row has the fields the rows render', universe.every((r) =>
  r.symbol && r.name && r.sector && r.scores && r.ranks && r.components !== undefined && r.logo));
ok('every row has industryRanks key', universe.every((r) => 'industryRanks' in r));
ok('closes exist for every symbol', universe.every((r) => Array.isArray(closesFor(r.symbol))));
ok('closes align to the date axis', universe.every((r) => closesFor(r.symbol).length === dates.length));
ok('benchmark series available', Array.isArray(closesFor(benchmark.symbol)));

console.log('\nderived series');
const r0 = returnsFor('AAPL');
ok('returns start with null', r0[0] === null);
ok('returns length matches dates', r0.length === dates.length);
ok('returns are plausible', r0.slice(1).every((x) => x === null || (isNum(x) && Math.abs(x) < 0.9)));
ok('rebase starts at 100', Math.abs(rebase(closesFor('AAPL').slice(-252))[0] - 100) < 1e-9);

console.log('\nseriesFor covers every chartable kind');
ok('stock', seriesFor({ kind: 'stock', key: 'AAPL' }) !== null);
ok('sector', seriesFor({ kind: 'sector', key: 'Technology' }) !== null);
ok('industry', seriesFor({ kind: 'industry', key: industrySeries[0].key }) !== null);
ok('benchmark', seriesFor({ kind: 'benchmark' }) !== null);
ok('macro', seriesFor({ kind: 'macro', key: 'gold' }) !== null);
ok('unknown ref is null not a crash', seriesFor({ kind: 'nope', key: 'x' }) === null);
ok('benchmarksFor gives at least market + sector', benchmarksFor('AAPL').length >= 2);

console.log('\nsearch');
ok('exact ticker first', search('AAPL')[0].symbol === 'AAPL');
ok('lowercase works', search('aapl')[0].symbol === 'AAPL');
ok('company name works', search('microsoft').some((r) => r.symbol === 'MSFT'));
ok('industry term works', search('semiconductor').length > 0);
ok('sector term works', search('utilities').length > 0);
ok('nonsense returns nothing', search('zzzzqqq').length === 0);
ok('empty query returns nothing', search('').length === 0);

console.log('\ngrouping and drill-down');
ok('sector members are 25', membersOfSector('Technology').length === 25);
ok('industries in a sector are listed', industriesInSector('Technology').length > 0);
ok('tagged flag present', industriesInSector('Technology').every((i) => typeof i.tagged === 'boolean'));
ok('industry members resolve', membersOfIndustry(industrySeries[0].key).length === industrySeries[0].constituents);
ok('every sector series has a rank', sectorSeries.every((s) => s.ranks.blended.rank >= 1));
ok('macro board has 5 assets', macro.length === 5);
ok('macro series chart-ready', macro.every((m) => Array.isArray(m.values) && m.values.length === dates.length));

console.log('\nportfolio engine on real holdings');
const basket = ['AAPL', 'MSFT', 'NVDA', 'XOM', 'JNJ'];
const holdings = basket.map((s) => ({ symbol: s, weight: 20 }));
const a = analysePortfolio(holdings, returnsMapFor(basket), atrPctMapFor(basket));
ok('analysis produced', a && !a.insufficientData, a ? a.reason : 'null');
ok('overlap is a full year', a.overlap === 252, `${a.overlap}`);
ok('annual vol is plausible', a.annualVol > 0.05 && a.annualVol < 1.0, `${a.annualVol}`);
ok('diversification ratio > 1', a.diversificationRatio > 1, `${a.diversificationRatio}`);
ok('effective bets between 1 and N', a.effectiveBets >= 1 && a.effectiveBets <= basket.length, `${a.effectiveBets}`);
ok('correlation diagonal is 1', basket.every((_, i) => Math.abs(a.correlation[i][i] - 1) < 1e-9));
ok('correlation symmetric', Math.abs(a.correlation[0][1] - a.correlation[1][0]) < 1e-12);
ok('tech names correlate above energy pairing',
  a.correlation[0][1] > a.correlation[0][3],
  `AAPL-MSFT ${a.correlation[0][1].toFixed(2)} vs AAPL-XOM ${a.correlation[0][3].toFixed(2)}`);
ok('weighted ATR present', isNum(a.weightedAtrPct), `${a.weightedAtrPct}`);
ok('marginal impact for each holding', a.marginal.length === basket.length && a.marginal.every((m) => isNum(m.volWithout)));

const mv = expectedMovement(a, 10000);
ok('typical day under rough day', mv.typicalDayValue < mv.roughDayValue);
ok('typical day is a sane dollar amount', mv.typicalDayValue > 10 && mv.typicalDayValue < 2000, `${mv.typicalDayValue}`);
ok('month scales by sqrt(21)', Math.abs(mv.monthPct - a.dailyVol * Math.sqrt(21)) < 1e-12);

const d = describeRisk(a, mv);
ok('risk band assigned', typeof d.band.label === 'string' && d.band.label.length > 0);
ok('diversification worded', typeof d.diversification.label === 'string');
ok('sentences are plain English', d.sentences.length >= 5 && d.sentences.every((s) => s.length > 20));
console.log(`       band: ${d.band.label} / ${d.diversification.label}`);
d.sentences.forEach((s) => console.log(`       "${s}"`));

console.log('\nedge cases the screens can actually hit');
const single = analysePortfolio([{ symbol: 'AAPL', weight: 100 }], returnsMapFor(['AAPL']), atrPctMapFor(['AAPL']));
ok('single holding works', single && !single.insufficientData);
ok('single holding has DR 1', Math.abs(single.diversificationRatio - 1) < 1e-6, `${single.diversificationRatio}`);
ok('single holding marginal is null not NaN', single.marginal[0].volWithout === null);
ok('single holding describes itself', describeRisk(single, expectedMovement(single, 5000)).sentences.length >= 4);

const zeroWeights = analysePortfolio(
  [{ symbol: 'AAPL', weight: 0 }, { symbol: 'MSFT', weight: 0 }],
  returnsMapFor(['AAPL', 'MSFT']), {}
);
ok('all-zero weights fall back to equal, no NaN', isNum(zeroWeights.annualVol) && zeroWeights.annualVol > 0);

const big = universe.slice(0, 25).map((r) => ({ symbol: r.symbol, weight: 4 }));
const bigA = analysePortfolio(big, returnsMapFor(big.map((h) => h.symbol)), atrPctMapFor(big.map((h) => h.symbol)));
ok('25-holding basket computes', bigA && !bigA.insufficientData);
ok('25-holding effective bets sane', bigA.effectiveBets > 1 && bigA.effectiveBets <= 25, `${bigA.effectiveBets}`);
ok('redundancy list returns entries', Array.isArray(findRedundant(bigA, 0.7)));

console.log('\nmethodology text is wired to real values');
for (const k of ['score12', 'score6', 'blended']) {
  const e = explainMeasure(k);
  ok(`${k} explained`, e.title && e.formula && e.window && e.detail);
}
ok('manifest carries config the screens read',
  manifest.config.industries.minCountToTag >= 1 &&
  manifest.config.screen.exchanges.length > 0 &&
  manifest.config.liquidity.minMedianDollarVolume > 0);
ok('manifest dataQuality shapes match screen usage',
  typeof manifest.dataQuality.duplicatesDropped === 'number' &&
  Array.isArray(manifest.dataQuality.shortHistory) &&
  Array.isArray(manifest.dataQuality.warnings));

console.log(`\n${fail === 0 ? 'ALL APP CHECKS PASSED' : fail + ' APP CHECKS FAILED'}\n`);
process.exit(fail === 0 ? 0 : 1);

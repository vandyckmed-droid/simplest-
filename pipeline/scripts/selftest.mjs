// Analytics self-test. Checks the maths against hand-computable cases.
// Run: node pipeline/scripts/selftest.mjs

import { mean, stdev, zScore, rankDescending, pearson } from '../../app/src/analytics/stats.js';
import { annualiseReturn, annualiseVolatility, totalReturn, riskAdjustedMomentum, rebase, rebaseTogether, maxDrawdown } from '../../app/src/analytics/returns.js';
import { computeMomentum, rankUniverse, scoresFrom } from '../../app/src/analytics/momentum.js';
import { atr, trueRange, atrPercent } from '../../app/src/analytics/atr.js';
import { equalWeightSeries, groupsAtLeast } from '../../app/src/analytics/sectors.js';
import { analysePortfolio, expectedMovement, describeRisk, normaliseWeights, alignReturns, findRedundant } from '../../app/src/analytics/portfolio.js';

let pass = 0;
let fail = 0;
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

function check(name, cond, detail = '') {
  if (cond) { pass += 1; console.log(`  ok   ${name}`); }
  else { fail += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('\nstats');
check('mean', near(mean([1, 2, 3, 4]), 2.5));
check('stdev sample', near(stdev([2, 4, 4, 4, 5, 5, 7, 9]), 2.138089935299395, 1e-12));
check('stdev needs 2 points', stdev([1]) === null);
check('mean ignores nulls', near(mean([1, null, 3]), 2));
check('zScore', near(zScore(6, [2, 4, 4, 4, 5, 5, 7, 9]), (6 - 5) / 2.138089935299395, 1e-12));
check('zScore null on flat peers', zScore(5, [5, 5, 5]) === null);
check('pearson perfect', near(pearson([1, 2, 3, 4], [2, 4, 6, 8]), 1, 1e-12));
check('pearson inverse', near(pearson([1, 2, 3, 4], [4, 3, 2, 1]), -1, 1e-12));

const rk = rankDescending([{ v: 5 }, { v: 9 }, { v: 9 }, { v: 1 }, { v: null }], (x) => x.v);
check('rank best = 1', rk.ranks.get(1) === 1);
check('rank ties share', rk.ranks.get(2) === 1, `got ${rk.ranks.get(2)}`);
check('rank after tie skips', rk.ranks.get(0) === 3, `got ${rk.ranks.get(0)}`);
check('rank excludes null', !rk.ranks.has(4) && rk.count === 4);

console.log('\nreturns');
// 10% over exactly half a year (126 trading days) annualises to 1.1^2 - 1 = 21%.
check('annualiseReturn geometric', near(annualiseReturn(0.1, 126), 1.1 * 1.1 - 1, 1e-12));
check('annualiseReturn identity at 252d', near(annualiseReturn(0.37, 252), 0.37, 1e-12));
check('annualiseVolatility scales by sqrt252', near(annualiseVolatility([0.01, -0.01, 0.01, -0.01]), stdev([0.01, -0.01, 0.01, -0.01]) * Math.sqrt(252), 1e-12));

const ramp = Array.from({ length: 300 }, (_, i) => 100 * Math.pow(1.001, i));
check('totalReturn lags', near(totalReturn(ramp, 252, 21), Math.pow(1.001, 231) - 1, 1e-9));
check('priceAtLag 0 is last bar', near(totalReturn(ramp, 1, 0), 0.001, 1e-12));

const ram = riskAdjustedMomentum(ramp, 252, 21);
check('riskAdjustedMomentum window days', ram.windowDays === 231);
check('riskAdjustedMomentum observations', ram.observations === 231, `got ${ram.observations}`);
check('smooth ramp -> huge ratio', ram.ratio > 1000, `got ${ram.ratio}`);
check('short series -> null', riskAdjustedMomentum(ramp.slice(-50), 252, 21) === null);
check('rebase starts at 100', near(rebase([50, 75, 100])[0], 100));
check('rebase doubles to 200', near(rebase([50, 100])[1], 200));

// A short-history line must be rebased at the first COMMON date, not its own
// first date, and everything before that date must be nulled for every line.
const rt = rebaseTogether([
  [null, null, 100, 110],
  [50, 52, 55, 60.5],
]);
check('rebaseTogether finds the common start', rt.startIndex === 2);
check('rebaseTogether nulls before common start', rt.series[1][0] === null && rt.series[1][1] === null);
check('rebaseTogether rebases both at the common start', near(rt.series[0][2], 100) && near(rt.series[1][2], 100));
check('rebaseTogether preserves relative moves', near(rt.series[0][3], 110) && near(rt.series[1][3], 110, 1e-9));
check('rebaseTogether reports no overlap', rebaseTogether([[1, null], [null, 1]]).startIndex === -1);
check('maxDrawdown', near(maxDrawdown([100, 120, 60, 90]), 60 / 120 - 1, 1e-12));

console.log('\nmomentum framework');
const closes = Array.from({ length: 400 }, (_, i) => 100 * Math.pow(1.0008, i) * (1 + 0.01 * Math.sin(i / 3)));
const mom = computeMomentum(closes);
check('both horizons present', mom.h12_1 !== null && mom.h6_1 !== null);
check('12-1 window is 231 days', mom.h12_1.windowDays === 231);
check('6-1 window is 105 days', mom.h6_1.windowDays === 105);
check('blend is the 50/50 average', near(mom.blendedScore, 0.5 * mom.h12_1.ratio + 0.5 * mom.h6_1.ratio, 1e-12));
check('short history has no 12-1', computeMomentum(closes.slice(-200)).h12_1 === null);
check('short history still blends nothing', computeMomentum(closes.slice(-200)).blendedScore === null);

const rows = [
  { symbol: 'A', sector: 'Tech', scores: { score12: 3, score6: 2, blended: 2.5 } },
  { symbol: 'B', sector: 'Tech', scores: { score12: 1, score6: 1, blended: 1.0 } },
  { symbol: 'C', sector: 'Tech', scores: { score12: 2, score6: 3, blended: 2.5 } },
  { symbol: 'D', sector: 'Energy', scores: { score12: 5, score6: 0, blended: 2.5 } },
  { symbol: 'E', sector: 'Energy', scores: { score12: null, score6: 4, blended: null } },
];
const ranked = rankUniverse(rows, 'sector');
const by = (s) => ranked.find((r) => r.symbol === s);
check('global rank on score12', by('D').ranks.score12.global === 1 && by('A').ranks.score12.global === 2);
check('global count skips nulls', by('A').ranks.score12.globalOf === 4);
check('sector rank is separate', by('A').ranks.score12.group === 1 && by('D').ranks.score12.group === 1);
check('sector size reported', by('A').ranks.score12.groupOf === 3);
check('null score gets null rank', by('E').ranks.score12.global === null);
check('sector z uses sector peers', near(by('A').ranks.score12.groupZ, zScore(3, [3, 1, 2]), 1e-12));
check('z null when one peer', by('E').ranks.score6.groupZ !== null);

console.log('\nATR');
check('trueRange uses prev close gap', near(trueRange(12, 10, 8), 4));
check('trueRange plain range', near(trueRange(12, 10, 11), 2));
check('trueRange without prev close', near(trueRange(12, 10, null), 2));
const flatBars = Array.from({ length: 40 }, () => ({ high: 102, low: 98, close: 100 }));
check('ATR of constant 4-wide bars = 4', near(atr(flatBars, 14), 4, 1e-9));
check('ATR% = 4/100', near(atrPercent(flatBars, 14), 0.04, 1e-9));
check('ATR needs period+1 bars', atr(flatBars.slice(0, 10), 14) === null);

console.log('\nsector series');
const dates = ['d1', 'd2', 'd3'];
const ew = equalWeightSeries(dates, { X: [100, 110, 121], Y: [50, 45, 45] }, ['X', 'Y']);
check('equal weight starts at 100', near(ew.values[0], 100));
// day 2: X +10%, Y -10% -> average 0%
check('equal weight averages returns', near(ew.values[1], 100, 1e-12), `got ${ew.values[1]}`);
// day 3: X +10%, Y 0% -> average +5%
check('equal weight compounds', near(ew.values[2], 105, 1e-12), `got ${ew.values[2]}`);
const gap = equalWeightSeries(dates, { X: [100, null, 110], Y: [50, 55, null] }, ['X', 'Y']);
check('gaps do not fabricate returns', near(gap.values[1], 110, 1e-12), `got ${gap.values[1]}`);
check('membership counted per day', gap.membership[1] === 1);
check('groupsAtLeast filters', groupsAtLeast([{ i: 'a' }, { i: 'a' }, { i: 'b' }], 'i', 2).length === 1);

console.log('\nportfolio');
check('weights normalise', near(normaliseWeights({ A: 3, B: 1 }).A, 0.75));
check('zero weights fall back to equal', near(normaliseWeights({ A: 0, B: 0 }).A, 0.5));

// Two perfectly correlated names: no diversification benefit at all.
const same = Array.from({ length: 260 }, (_, i) => 0.01 * Math.sin(i / 5));
const identical = analysePortfolio(
  [{ symbol: 'A', weight: 1 }, { symbol: 'B', weight: 1 }],
  { A: same, B: same.slice() }
);
check('identical holdings -> DR 1', near(identical.diversificationRatio, 1, 1e-9), `got ${identical.diversificationRatio}`);
check('identical holdings -> 1 effective bet', near(identical.effectiveBets, 1, 1e-9));
check('identical holdings -> correlation 1', near(identical.correlation[0][1], 1, 1e-9));
check('redundancy flagged', findRedundant(identical).length === 2);

// Two independent names of equal vol: portfolio vol should fall by ~sqrt(2).
const a = Array.from({ length: 400 }, (_, i) => 0.01 * Math.sin(i / 2.0));
const b = Array.from({ length: 400 }, (_, i) => 0.01 * Math.cos(i / 2.0));
const mixed = analysePortfolio([{ symbol: 'A', weight: 1 }, { symbol: 'B', weight: 1 }], { A: a, B: b });
check('uncorrelated pair diversifies', mixed.diversificationRatio > 1.3, `DR ${mixed.diversificationRatio.toFixed(3)}`);
check('effective bets above 1', mixed.effectiveBets > 1.5, `${mixed.effectiveBets.toFixed(2)}`);
check('marginal removal reported', mixed.marginal.length === 2 && mixed.marginal[0].volWithout !== null);

const mv = expectedMovement(mixed, 10000);
check('movement scales with value', near(mv.typicalDayValue, mv.typicalDayPct * 10000, 1e-9));
check('rough day is the two-sided 1-in-20 (1.96 sd)', near(mv.roughDayPct, mv.typicalDayPct * 1.96, 1e-12));
check('drawdown day is the one-sided 1-in-20 (1.65 sd)', near(mv.drawdownDayPct, -mv.typicalDayPct * 1.65, 1e-12));
check('month wider than day', mv.monthPct > mv.typicalDayPct);
const desc = describeRisk(mixed, mv);
check('plain language produced', desc.sentences.length >= 4 && typeof desc.band.label === 'string');
check('no jargon leaked', !desc.sentences.join(' ').match(/sigma|variance|stdev/i));

// Listwise alignment: a hole in one series must drop that date for all series.
const al = alignReturns({ A: [0.1, null, 0.3, 0.4], B: [0.1, 0.2, 0.3, 0.4] }, ['A', 'B'], 10);
check('alignReturns drops incomplete dates', al.overlap === 3, `got ${al.overlap}`);
check('alignReturns keeps rows aligned', al.matrix[0].length === al.matrix[1].length);

const thin = analysePortfolio([{ symbol: 'A', weight: 1 }], { A: [0.01, 0.02] });
check('thin history reported not guessed', thin.insufficientData === true);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);

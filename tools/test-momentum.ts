/**
 * Tests for the 12–1 momentum maths, run with `npm test`.
 *
 * Every expectation here is worked out by hand in the comments, so a wrong
 * answer is obvious rather than merely different from last time. The window
 * bounds are parameters, which lets the cases use short price series whose
 * arithmetic can be checked on paper.
 */

import {
  annualizedVolatility,
  logReturns,
  momentum12_1,
  momentum6_1,
  momentumBlend,
  momentumWindow,
  percentileRanks,
  totalReturn,
  windowSlice,
} from '../src/momentum.ts';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Read the dataset straight off disk rather than through the app module, so
// the maths is tested without depending on how the bundler loads JSON.
const RANKS: { symbol: string; history: { closes: number[] } }[] = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/market.json', import.meta.url)), 'utf8'),
).stocks;

let failures = 0;
let checks = 0;

function ok(condition: boolean, message: string) {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.error(`  FAIL  ${message}`);
  }
}

function close(actual: number, expected: number, message: string, tolerance = 1e-9) {
  checks += 1;
  if (!(Math.abs(actual - expected) <= tolerance)) {
    failures += 1;
    console.error(`  FAIL  ${message}: got ${actual}, expected ${expected}`);
  }
}

console.log('window bounds');
{
  // Day −k is index n−1−k. With n = 10, lookback 4 and skip 1:
  //   from = 9 − 4 = 5, to = 9 − 1 = 8.
  const closes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const w = windowSlice(closes, { lookback: 4, skip: 1 })!;
  ok(w.fromIndex === 5, `fromIndex should be 5, got ${w.fromIndex}`);
  ok(w.toIndex === 8, `toIndex should be 8, got ${w.toIndex}`);
  ok(
    JSON.stringify(w.slice) === JSON.stringify([6, 7, 8, 9]),
    `slice should be [6,7,8,9], got ${JSON.stringify(w.slice)}`,
  );
  // The default window needs 253 prices: day −252 must exist.
  ok(windowSlice(new Array(252).fill(100)) === null, '252 prices is too short');
  ok(windowSlice(new Array(253).fill(100)) !== null, '253 prices is long enough');
  ok(windowSlice([1, 2, 3], { lookback: 2, skip: 2 }) === null, 'empty window rejected');
  ok(windowSlice([1, -2, 3, 4], { lookback: 3, skip: 0 }) === null, 'negative price rejected');
}

console.log('12–1 return');
{
  // Prices rise 10% a step. With lookback 4 and skip 1 on 6 prices:
  //   from = 5 − 4 = 1 (110), to = 5 − 1 = 4 (146.41).
  //   return = 146.41 / 110 − 1 = 0.331 exactly.
  const closes = [100, 110, 121, 133.1, 146.41, 200];
  const m = momentumWindow(closes, { lookback: 4, skip: 1 })!;
  close(m.totalReturn, 0.331, '10%-a-step return', 1e-12);
  // The 200 is inside the skipped month and must not leak in.
  ok(m.toIndex === 4, `window must end before the skipped tail, got ${m.toIndex}`);
}
{
  // A doubling over the window: 50 -> 100 is +100%.
  const closes = [999, 50, 70, 80, 100, 12345];
  close(
    momentumWindow(closes, { lookback: 4, skip: 1 })!.totalReturn,
    1,
    'doubling is +100%',
    1e-12,
  );
}
{
  // A halving is −50%.
  close(totalReturn([200, 150, 100]), -0.5, 'halving is −50%', 1e-12);
}

console.log('log returns');
{
  const r = logReturns([100, 110, 99]);
  ok(r.length === 2, `3 prices give 2 returns, got ${r.length}`);
  close(r[0], Math.log(1.1), 'first log return');
  close(r[1], Math.log(0.9), 'second log return');
}

console.log('annualised volatility');
{
  // A perfectly steady climb has no dispersion at all.
  close(annualizedVolatility([0.01, 0.01, 0.01, 0.01]), 0, 'constant returns give zero vol');
}
{
  // Log returns alternating +0.1 and −0.1: mean 0, so the sample variance is
  //   (4 × 0.1²) / 3 = 0.0133333…, sd = 0.11547005383792515,
  //   annualised = sd × √252 = 0.11547005383792515 × 15.874507866387544
  //              = 1.8330302779823362
  const sd = Math.sqrt(0.04 / 3);
  const expected = sd * Math.sqrt(252);
  close(annualizedVolatility([0.1, -0.1, 0.1, -0.1]), expected, 'alternating ±0.1 vol', 1e-12);
  close(expected, 1.8330302779823362, 'hand-computed annualised value', 1e-12);
}
{
  // Sample (n−1) rather than population (n): [0, 0.2] has sd 0.1414213…,
  // not 0.1. Population would give 0.1 × √252 = 1.5874507866387544.
  close(
    annualizedVolatility([0, 0.2]),
    Math.sqrt(0.02) * Math.sqrt(252),
    'two returns use the sample deviation',
    1e-12,
  );
  ok(
    Math.abs(annualizedVolatility([0, 0.2]) - 0.1 * Math.sqrt(252)) > 0.1,
    'volatility must not use the population deviation',
  );
}

console.log('risk-adjusted momentum');
{
  // Prices ×e^0.1 then ÷e^0.1, four steps, ending where they started.
  //   return = 0, vol = 1.8330302779823362 (above), so return ÷ vol = 0.
  const e = Math.exp(0.1);
  const closes = [100, 100 * e, 100, 100 * e, 100];
  const m = momentumWindow(closes, { lookback: 4, skip: 0 })!;
  close(m.totalReturn, 0, 'round trip returns nothing', 1e-12);
  close(m.volatility, Math.sqrt(0.04 / 3) * Math.sqrt(252), 'round-trip vol', 1e-12);
  close(m.riskAdjusted!, 0, 'zero return over positive vol is zero', 1e-12);
}
{
  // A straight line has no volatility to speak of — in exact arithmetic it is
  // zero, in floating point it is a crumb around 1e-16 — so there is nothing
  // to divide by and the ratio must be null rather than astronomical.
  const m = momentumWindow([100, 110, 121, 133.1, 146.41], { lookback: 4, skip: 0 })!;
  close(m.volatility, 0, 'steady growth has effectively zero vol', 1e-12);
  ok(m.riskAdjusted === null, 'negligible volatility gives a null ratio, not a huge one');
  ok(
    momentumWindow([100, 100, 100, 100, 100], { lookback: 4, skip: 0 })!.riskAdjusted === null,
    'an unchanged price gives a null ratio',
  );
}
{
  // Return 0.331 over a known vol divides out exactly.
  const e = Math.exp(0.1);
  const closes = [100, 100 * e, 100, 100 * e, 100 * e * 1.331];
  const m = momentumWindow(closes, { lookback: 4, skip: 0 })!;
  close(m.riskAdjusted!, m.totalReturn / m.volatility, 'ratio is return ÷ vol', 1e-12);
}

console.log('percentile ranks');
{
  // Four distinct values: 0, 100/3, 200/3, 100.
  const p = percentileRanks([1, 2, 3, 4]);
  close(p[0]!, 0, 'lowest is 0');
  close(p[1]!, 100 / 3, 'second is 33.33');
  close(p[2]!, 200 / 3, 'third is 66.67');
  close(p[3]!, 100, 'highest is 100');
}
{
  // Order of the input must not matter.
  const p = percentileRanks([4, 1, 3, 2]);
  close(p[0]!, 100, 'highest is 100 wherever it sits');
  close(p[1]!, 0, 'lowest is 0 wherever it sits');
}
{
  // Ties share the lower percentile.
  const p = percentileRanks([1, 1, 2]);
  close(p[0]!, 0, 'tied low is 0');
  close(p[1]!, 0, 'tied low is 0 for both');
  close(p[2]!, 100, 'clear high is 100');
}
{
  // Negatives rank below positives.
  const p = percentileRanks([-2, -1, 0, 1]);
  close(p[0]!, 0, 'most negative is 0');
  close(p[3]!, 100, 'most positive is 100');
}
{
  const p = percentileRanks([null, 5, null]);
  ok(p[0] === null && p[2] === null, 'missing values stay missing');
  close(p[1]!, 100, 'a single ranked value is 100');
  ok(percentileRanks([null, null]).every((v) => v === null), 'an empty field is all null');
}

console.log('determinism');
{
  const closes = [100, 110, 99, 108.9, 98.01, 107.8, 120, 130];
  const a = momentumWindow(closes, { lookback: 6, skip: 1 })!;
  const b = momentumWindow(closes, { lookback: 6, skip: 1 })!;
  ok(JSON.stringify(a) === JSON.stringify(b), 'same input gives an identical result');
}

console.log('the two windows');
{
  // 12–1 needs 253 prices, 6–1 needs 127. Both end at day −21.
  ok(momentum12_1(new Array(252).fill(100)) === null, '12–1 needs 253 prices');
  ok(momentum12_1(new Array(253).fill(100)) !== null, '12–1 has enough at 253');
  ok(momentum6_1(new Array(126).fill(100)) === null, '6–1 needs 127 prices');
  ok(momentum6_1(new Array(127).fill(100)) !== null, '6–1 has enough at 127');

  // On a long series the windows share their right edge and differ on the left.
  const closes = Array.from({ length: 400 }, (_, i) => 100 * 1.001 ** i);
  const long = momentum12_1(closes)!;
  const short = momentum6_1(closes)!;
  ok(long.toIndex === short.toIndex, 'both windows end on the same day');
  ok(long.toIndex === 399 - 21, 'both end at day −21');
  ok(long.fromIndex === 399 - 252, '12–1 opens at day −252');
  ok(short.fromIndex === 399 - 126, '6–1 opens at day −126');
  // Steady 0.1%-a-step growth: 231 steps vs 105 steps.
  close(long.totalReturn, 1.001 ** 231 - 1, '12–1 return over 231 steps', 1e-12);
  close(short.totalReturn, 1.001 ** 105 - 1, '6–1 return over 105 steps', 1e-12);
}

console.log('momentum blend');
{
  // Half of each percentile.
  close(momentumBlend(100, 0)!, 50, 'top of one, bottom of the other');
  close(momentumBlend(100, 100)!, 100, 'top of both');
  close(momentumBlend(0, 0)!, 0, 'bottom of both');
  close(momentumBlend(80, 40)!, 60, '80 and 40 blend to 60');
  close(momentumBlend(33.5, 66.5)!, 50, 'halves that meet in the middle');
  // A missing half means no blend, not a half-informed one.
  ok(momentumBlend(null, 50) === null, 'no 12–1 means no blend');
  ok(momentumBlend(50, null) === null, 'no 6–1 means no blend');
  ok(momentumBlend(null, null) === null, 'neither means no blend');
}

console.log('against the real dataset');
{
  for (const stock of RANKS) {
    const closes = stock.history.closes;
    const n = closes.length;

    for (const [name, m, lookback] of [
      ['12–1', momentum12_1(closes)!, 252],
      ['6–1', momentum6_1(closes)!, 126],
    ] as const) {
      ok(m !== null, `${stock.symbol} ${name}: has a window`);
      ok(m.fromIndex === n - 1 - lookback, `${stock.symbol} ${name}: opens at day −${lookback}`);
      ok(m.toIndex === n - 1 - 21, `${stock.symbol} ${name}: closes at day −21`);

      // Recomputed straight from the raw prices, independent of the module.
      const expected = closes[n - 22] / closes[n - 1 - lookback] - 1;
      close(m.totalReturn, expected, `${stock.symbol} ${name}: return matches raw prices`, 1e-12);

      ok(m.volatility > 0.02 && m.volatility < 3, `${stock.symbol} ${name}: vol ${m.volatility} plausible`);
      ok(
        m.riskAdjusted !== null && Number.isFinite(m.riskAdjusted),
        `${stock.symbol} ${name}: risk-adjusted value is finite`,
      );

      // The most recent 21 days must not influence either window.
      const tampered = closes.slice(0, -21).concat(new Array(21).fill(closes[n - 22] * 3));
      const after = name === '12–1' ? momentum12_1(tampered)! : momentum6_1(tampered)!;
      close(
        after.totalReturn,
        m.totalReturn,
        `${stock.symbol} ${name}: the skipped month cannot change the signal`,
        1e-12,
      );
    }
  }

  const longPct = percentileRanks(RANKS.map((s) => momentum12_1(s.history.closes)!.riskAdjusted));
  const shortPct = percentileRanks(RANKS.map((s) => momentum6_1(s.history.closes)!.riskAdjusted));
  for (const pcts of [longPct, shortPct]) {
    ok(Math.min(...(pcts as number[])) === 0, 'the weakest name sits at 0');
    ok(Math.max(...(pcts as number[])) === 100, 'the strongest name sits at 100');
  }

  const blends = RANKS.map((_, i) => momentumBlend(longPct[i], shortPct[i])!);
  ok(blends.every((b) => b >= 0 && b <= 100), 'every blend lands on 0–100');
  for (let i = 0; i < blends.length; i += 1) {
    close(blends[i], (longPct[i]! + shortPct[i]!) / 2, `${RANKS[i].symbol}: blend is the mean of the two ranks`);
  }
}

console.log(
  failures === 0
    ? `\n${checks} checks passed`
    : `\n${failures} of ${checks} checks FAILED`,
);
process.exit(failures === 0 ? 0 : 1);

// Portfolio risk analytics.
//
// The goal of this module is to turn a basket of weights into sentences a person
// can act on: how much this moves on a normal day, how much on a bad one, and
// whether the holdings are really different bets or the same bet repeated.

import { TRADING_DAYS_PER_YEAR, clamp, isNum, mean, pearson, stdev } from './stats.js';

export function normaliseWeights(weights) {
  const keys = Object.keys(weights);
  let total = 0;
  for (const k of keys) if (isNum(weights[k]) && weights[k] > 0) total += weights[k];
  const out = {};
  if (total <= 0) {
    // Fall back to equal weight rather than dividing by zero.
    for (const k of keys) out[k] = keys.length ? 1 / keys.length : 0;
    return out;
  }
  for (const k of keys) out[k] = isNum(weights[k]) && weights[k] > 0 ? weights[k] / total : 0;
  return out;
}

// Aligns daily return series so every symbol contributes the same dates.
//
// Series here are already indexed against one shared trading calendar, with null
// on days a security did not trade. Any date where a selected holding is missing
// is dropped for every holding, so the covariance matrix is built from genuinely
// simultaneous observations rather than accidentally offset ones.
export function alignReturns(returnsBySymbol, symbols, lookback = TRADING_DAYS_PER_YEAR) {
  const series = symbols.map((s) => returnsBySymbol[s] || []);
  if (series.length === 0) return { matrix: [], overlap: 0 };

  const len = Math.min(...series.map((r) => r.length));
  if (!Number.isFinite(len) || len < 2) return { matrix: [], overlap: 0 };

  // Walk backwards from the most recent date, keeping complete rows only.
  const kept = [];
  for (let k = 1; k <= len && kept.length < lookback; k += 1) {
    const col = series.map((r) => r[r.length - k]);
    if (col.every(isNum)) kept.push(col);
  }
  kept.reverse();

  const matrix = symbols.map((_, i) => kept.map((col) => col[i]));
  return { matrix, overlap: kept.length };
}

export function covarianceMatrix(matrix) {
  const n = matrix.length;
  const means = matrix.map((r) => mean(r) || 0);
  const cov = Array.from({ length: n }, () => new Array(n).fill(0));
  const T = n ? matrix[0].length : 0;
  if (T < 2) return cov;
  for (let i = 0; i < n; i += 1) {
    for (let j = i; j < n; j += 1) {
      let s = 0;
      for (let t = 0; t < T; t += 1) s += (matrix[i][t] - means[i]) * (matrix[j][t] - means[j]);
      const v = s / (T - 1);
      cov[i][j] = v;
      cov[j][i] = v;
    }
  }
  return cov;
}

export function correlationMatrix(matrix) {
  const n = matrix.length;
  const corr = Array.from({ length: n }, () => new Array(n).fill(null));
  for (let i = 0; i < n; i += 1) {
    corr[i][i] = 1;
    for (let j = i + 1; j < n; j += 1) {
      const c = pearson(matrix[i], matrix[j]);
      corr[i][j] = c;
      corr[j][i] = c;
    }
  }
  return corr;
}

function portfolioVariance(cov, w) {
  let v = 0;
  for (let i = 0; i < w.length; i += 1) {
    for (let j = 0; j < w.length; j += 1) v += w[i] * w[j] * cov[i][j];
  }
  return Math.max(v, 0);
}

/**
 * Core risk calculation.
 *
 * holdings: [{ symbol, weight }] - weights are normalised internally
 * returnsBySymbol: { SYM: [daily simple returns, oldest first] }
 * atrPercentBySymbol: { SYM: atr / price }
 */
export function analysePortfolio(holdings, returnsBySymbol, atrPercentBySymbol = {}, opts = {}) {
  const lookback = opts.lookback || TRADING_DAYS_PER_YEAR;
  const symbols = holdings.map((h) => h.symbol);
  if (symbols.length === 0) return null;

  const wMap = normaliseWeights(
    holdings.reduce((acc, h) => ({ ...acc, [h.symbol]: h.weight }), {})
  );
  const w = symbols.map((s) => wMap[s]);

  const { matrix, overlap } = alignReturns(returnsBySymbol, symbols, lookback);
  if (overlap < 20) {
    return {
      insufficientData: true,
      overlap,
      symbols,
      weights: wMap,
      reason: 'Not enough overlapping history across these holdings to measure risk.',
    };
  }

  const cov = covarianceMatrix(matrix);
  const corr = correlationMatrix(matrix);

  const dailyVol = Math.sqrt(portfolioVariance(cov, w));
  const annualVol = dailyVol * Math.sqrt(TRADING_DAYS_PER_YEAR);

  // Individual annualised vols, and the weighted average of them. The gap
  // between that average and the portfolio's own vol IS the diversification.
  const individualVol = symbols.map((s, i) => (stdev(matrix[i]) || 0) * Math.sqrt(TRADING_DAYS_PER_YEAR));
  const weightedAvgVol = symbols.reduce((s, _, i) => s + w[i] * individualVol[i], 0);
  const diversificationRatio = annualVol > 0 ? weightedAvgVol / annualVol : 1;

  // DR² approximates how many genuinely independent positions you hold.
  const effectiveBets = clamp(diversificationRatio * diversificationRatio, 1, symbols.length);

  // Weighted ATR gives a second, price-based read on the typical daily swing.
  let weightedAtrPct = 0;
  let atrCoverage = 0;
  symbols.forEach((s, i) => {
    const a = atrPercentBySymbol[s];
    if (isNum(a)) {
      weightedAtrPct += w[i] * a;
      atrCoverage += w[i];
    }
  });
  weightedAtrPct = atrCoverage > 0 ? weightedAtrPct / atrCoverage : null;

  // Per-holding redundancy: how correlated is this name with the rest of the
  // book, weighted by how much of the book the rest represents.
  const redundancy = symbols.map((s, i) => {
    let num = 0;
    let den = 0;
    for (let j = 0; j < symbols.length; j += 1) {
      if (i === j || !isNum(corr[i][j])) continue;
      num += w[j] * corr[i][j];
      den += w[j];
    }
    const avgCorr = den > 0 ? num / den : null;
    return { symbol: s, weight: w[i], avgCorrelation: avgCorr, individualVol: individualVol[i] };
  });

  // Marginal effect of dropping each holding, with the rest re-normalised.
  const marginal = symbols.map((s, i) => {
    if (symbols.length < 2) return { symbol: s, volWithout: null, delta: null };
    const keep = symbols.map((_, j) => j).filter((j) => j !== i);
    const rest = keep.map((j) => w[j]);
    const restTotal = rest.reduce((a, b) => a + b, 0);
    if (restTotal <= 0) return { symbol: s, volWithout: null, delta: null };
    const wr = rest.map((x) => x / restTotal);
    const covr = keep.map((j) => keep.map((k) => cov[j][k]));
    const volWithout = Math.sqrt(portfolioVariance(covr, wr)) * Math.sqrt(TRADING_DAYS_PER_YEAR);
    return { symbol: s, volWithout, delta: volWithout - annualVol };
  });

  const avgPairCorr = (() => {
    const vals = [];
    for (let i = 0; i < symbols.length; i += 1) {
      for (let j = i + 1; j < symbols.length; j += 1) if (isNum(corr[i][j])) vals.push(corr[i][j]);
    }
    return vals.length ? mean(vals) : null;
  })();

  return {
    insufficientData: false,
    symbols,
    weights: wMap,
    overlap,
    lookback,
    dailyVol,
    annualVol,
    individualVol,
    weightedAvgVol,
    diversificationRatio,
    effectiveBets,
    weightedAtrPct,
    correlation: corr,
    avgPairCorrelation: avgPairCorr,
    redundancy,
    marginal,
  };
}

/**
 * Expected-movement figures in the units people actually think in.
 * `value` is the money amount invested.
 */
export function expectedMovement(analysis, value = 10000) {
  if (!analysis || analysis.insufficientData) return null;
  const d = analysis.dailyVol;

  // A normal day: roughly ±1 standard deviation of daily moves.
  const typicalDayPct = d;
  // A rough day: ~1.65 sd, which is exceeded about one day in twenty.
  const roughDayPct = d * 1.65;
  const monthPct = d * Math.sqrt(21);
  const yearPct = analysis.annualVol;

  return {
    typicalDayPct,
    typicalDayValue: typicalDayPct * value,
    roughDayPct,
    roughDayValue: roughDayPct * value,
    atrDayPct: analysis.weightedAtrPct,
    atrDayValue: isNum(analysis.weightedAtrPct) ? analysis.weightedAtrPct * value : null,
    monthPct,
    monthValue: monthPct * value,
    yearPct,
    yearValue: yearPct * value,
    // Worst 1-in-20 day, expressed as a loss.
    drawdownDayPct: -roughDayPct,
    drawdownDayValue: -roughDayPct * value,
    value,
  };
}

// Plain-language summary. Deliberately avoids the words sigma, variance and beta.
export function describeRisk(analysis, movement) {
  if (!analysis || analysis.insufficientData || !movement) return null;

  const annual = analysis.annualVol;
  let band;
  if (annual < 0.12) band = { label: 'Calm', tone: 'low' };
  else if (annual < 0.20) band = { label: 'Steady', tone: 'low' };
  else if (annual < 0.30) band = { label: 'Lively', tone: 'mid' };
  else if (annual < 0.45) band = { label: 'Jumpy', tone: 'high' };
  else band = { label: 'Wild', tone: 'high' };

  const dr = analysis.diversificationRatio;
  let diversification;
  if (dr >= 1.6) diversification = { label: 'Well spread', tone: 'low' };
  else if (dr >= 1.3) diversification = { label: 'Reasonably spread', tone: 'low' };
  else if (dr >= 1.12) diversification = { label: 'Somewhat concentrated', tone: 'mid' };
  else diversification = { label: 'Highly concentrated', tone: 'high' };

  const pct = (x) => `${(x * 100).toFixed(1)}%`;
  const money = (x) => `$${Math.round(Math.abs(x)).toLocaleString('en-US')}`;

  const sentences = [
    `On a normal day this basket moves about ${pct(movement.typicalDayPct)}, or roughly ${money(movement.typicalDayValue)} on ${money(movement.value)}.`,
    `About one day in twenty it moves more than ${pct(movement.roughDayPct)} — around ${money(movement.roughDayValue)} — in either direction.`,
    `Over a month, a move of ${pct(movement.monthPct)} either way would be unremarkable.`,
  ];

  if (isNum(movement.atrDayPct)) {
    sentences.push(
      `Measured by average true range instead, the holdings typically travel ${pct(movement.atrDayPct)} between their high and low each day.`
    );
  }

  if (analysis.symbols.length === 1) {
    sentences.push('A single holding carries the full risk of that one company.');
  } else {
    const c = analysis.avgPairCorrelation;
    // The explanation has to match the number. Saying "because they move
    // together" over a near-zero correlation would contradict the figure
    // printed beside it.
    let relation;
    if (!isNum(c)) relation = 'their relationship could not be measured';
    else if (c >= 0.6) relation = 'they move very closely together';
    else if (c >= 0.3) relation = 'they tend to move together';
    else if (c >= 0.1) relation = 'they move together only loosely';
    else if (c >= -0.1) relation = 'they move largely independently of one another';
    else relation = 'they often move in opposite directions, which cushions the basket';

    const n = analysis.symbols.length;
    const bets = analysis.effectiveBets;
    const closeness = bets >= n - 0.3
      ? `almost the full ${n}`
      : `about ${bets.toFixed(1)} of your ${n}`;

    sentences.push(
      `Your ${n} holdings work like ${closeness} genuinely separate bets, because ${relation}` +
        `${isNum(c) ? ` (average pairing ${c.toFixed(2)})` : ''}.`
    );
  }

  return { band, diversification, sentences };
}

// Holdings that add the least new information to the basket.
export function findRedundant(analysis, threshold = 0.7) {
  if (!analysis || analysis.insufficientData) return [];
  return analysis.redundancy
    .filter((r) => isNum(r.avgCorrelation) && r.avgCorrelation >= threshold)
    .sort((a, b) => b.avgCorrelation - a.avgCorrelation);
}

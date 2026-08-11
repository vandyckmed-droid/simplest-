// The momentum ranking framework.
//
// One definition lives here and is used by the pipeline, the stock screens, the
// sector screens and the methodology screen, so a displayed rank can never drift
// away from the maths that produced it.

import { TRADING_DAYS_PER_MONTH, isNum, rankDescending, zScore } from './stats.js';
import { riskAdjustedMomentum } from './returns.js';

const M = TRADING_DAYS_PER_MONTH;

// Both horizons skip the most recent month (`toLag: 21`). Skipping it is standard
// practice for momentum: the latest month tends to mean-revert and would other-
// wise fight the signal.
export const HORIZONS = {
  h12_1: {
    key: 'h12_1',
    label: '12-1',
    longLabel: '12 month, skipping the last month',
    fromLag: 12 * M, // 252 trading days back
    toLag: 1 * M, //  21 trading days back
  },
  h6_1: {
    key: 'h6_1',
    label: '6-1',
    longLabel: '6 month, skipping the last month',
    fromLag: 6 * M, // 126 trading days back
    toLag: 1 * M, //  21 trading days back
  },
};

export const BLEND_WEIGHTS = { h12_1: 0.5, h6_1: 0.5 };

// Minimum bars a security needs before it can be ranked on a horizon. A newly
// listed name simply has no 12-1 score rather than a misleadingly short one.
export function minimumBarsFor(horizon) {
  return horizon.fromLag + 1;
}

// Per-security measures. `closes` is oldest-first adjusted closes.
export function computeMomentum(closes) {
  const out = { h12_1: null, h6_1: null, blendedScore: null, bars: closes.length };

  for (const key of Object.keys(HORIZONS)) {
    const h = HORIZONS[key];
    out[key] = closes.length >= minimumBarsFor(h)
      ? riskAdjustedMomentum(closes, h.fromLag, h.toLag)
      : null;
  }

  // Both horizons are return-per-unit-of-risk, so they share units and can be
  // averaged directly. No standardisation step is hidden inside the blend.
  const a = out.h12_1 ? out.h12_1.ratio : null;
  const b = out.h6_1 ? out.h6_1.ratio : null;
  if (isNum(a) && isNum(b)) {
    out.blendedScore = BLEND_WEIGHTS.h12_1 * a + BLEND_WEIGHTS.h6_1 * b;
  }
  return out;
}

// The three headline measures every ranked view uses.
export const MEASURES = [
  { key: 'score12', label: '12-1 risk-adjusted', short: '12-1' },
  { key: 'score6', label: '6-1 risk-adjusted', short: '6-1' },
  { key: 'blended', label: 'Blended momentum', short: 'Blend' },
];

// Flattens computeMomentum output into the scalar scores that get ranked.
export function scoresFrom(momentum) {
  return {
    score12: momentum && momentum.h12_1 ? momentum.h12_1.ratio : null,
    score6: momentum && momentum.h6_1 ? momentum.h6_1.ratio : null,
    blended: momentum ? momentum.blendedScore : null,
  };
}

/**
 * Adds global ranks, sector-relative ranks and sector-relative z-scores for all
 * three measures onto every row.
 *
 * rows: [{ symbol, sector, scores: {score12, score6, blended}, ... }]
 * Mutates nothing; returns new row objects with a `ranks` block.
 */
export function rankUniverse(rows, groupKey = 'sector') {
  const measureKeys = MEASURES.map((m) => m.key);
  const result = rows.map((r) => ({ ...r, ranks: {} }));

  // Global ranks, computed across every security that has the measure.
  for (const key of measureKeys) {
    const { ranks, count } = rankDescending(result, (r) => r.scores[key]);
    result.forEach((r, i) => {
      r.ranks[key] = {
        global: ranks.has(i) ? ranks.get(i) : null,
        globalOf: count,
        group: null,
        groupOf: null,
        groupZ: null,
      };
    });
  }

  // Group-relative ranks and z-scores, one group at a time.
  const groups = new Map();
  result.forEach((r, i) => {
    const g = r[groupKey];
    if (!g) return;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(i);
  });

  for (const [, idxs] of groups) {
    const members = idxs.map((i) => result[i]);
    for (const key of measureKeys) {
      const peers = members.map((m) => m.scores[key]).filter(isNum);
      const { ranks, count } = rankDescending(members, (m) => m.scores[key]);
      members.forEach((m, j) => {
        m.ranks[key].group = ranks.has(j) ? ranks.get(j) : null;
        m.ranks[key].groupOf = count;
        m.ranks[key].groupZ = zScore(m.scores[key], peers);
      });
    }
  }

  return result;
}

// Human-readable description of exactly how a measure was produced. The detail
// screens render this verbatim so the number is never unexplained.
export function explainMeasure(measureKey) {
  if (measureKey === 'score12') {
    return {
      title: '12-1 risk-adjusted momentum',
      formula: 'annualised return ÷ annualised volatility',
      window: 'From 252 trading days ago to 21 trading days ago (231 days).',
      detail:
        'Total return over the window is compounded to an annual rate. Volatility is the standard deviation of daily log returns over that identical window, multiplied by √252. The score is one divided by the other, so it reads like a return per unit of risk.',
    };
  }
  if (measureKey === 'score6') {
    return {
      title: '6-1 risk-adjusted momentum',
      formula: 'annualised return ÷ annualised volatility',
      window: 'From 126 trading days ago to 21 trading days ago (105 days).',
      detail:
        'Identical maths to the 12-1 measure over a shorter, faster-moving window. Because both scores are annualised the same way, they are directly comparable.',
    };
  }
  return {
    title: 'Blended momentum',
    formula: '(0.5 × 12-1 score) + (0.5 × 6-1 score)',
    window: 'Inherits both windows above.',
    detail:
      'Both inputs are already return-per-unit-of-risk, so they share units and are averaged directly with no hidden rescaling. A security needs both horizons to receive a blended score.',
  };
}

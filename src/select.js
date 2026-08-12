// Basket filler: walk a ranked list and take names that add something.
//
// This file is both a Node module (so `npm run test:select` can check it) and
// the page's selector: src/ranks-render.js inlines this source into the
// template, stripping only the export line at the bottom. Nothing here touches
// the DOM or imports anything.
//
// The rule, in order of how much work each part does:
//
//   1. Walk the ranking from the top. Rank is the whole point; the filter only
//      ever says no.
//   2. Reject a candidate whose MEAN correlation to what is already held
//      reaches `avg`. This does essentially all of the diversification work.
//   3. Reject a candidate that is a near-duplicate of any ONE holding — RAW
//      correlation above `veto`. This barely moves aggregate risk but stops the
//      basket holding the same thing twice, which matters for reasons variance
//      does not capture.
//   4. Stop at `want` names, or when the pool runs out. If the rule cannot find
//      enough it returns fewer. It never pads.
//
// Why those two tests and not the obvious alternatives, measured over the top
// 50 by selecting on one half-year and scoring on the next:
//
//   method                        effective bets, out of sample
//   top 20 by rank                        4.2
//   mean correlation < 0.12               6.7      <- the whole gain
//   max correlation < 0.35 only           4.7
//   cluster at 0.25 + sqrt(size) slots    4.5
//
// Clustering and max-thresholding look competitive in sample and mostly
// evaporate out of it. They are not wrong, they are weak: a duplicate test only
// excludes the handful of names that have a twin, so it cannot move an
// aggregate. The mean test reshapes the whole basket.
//
// Two details that are easy to get backwards:
//
// **The mean runs on shrunk correlations, the veto on raw ones.** Ledoit-Wolf
// pulls every correlation toward the average, which is right for a statistic
// you average over and wrong for "is this the same thing twice": at the
// shrinkage a half-year sample earns, MU/WDC reads 0.43 when it is really 0.66,
// and a veto set on shrunk numbers waves it through.
//
// **Padding to a target silently disables the filter.** Topping a short result
// up with the next-highest-ranked names puts back exactly what the rule
// rejected, which makes every threshold produce the same basket.

const AVG = 0.12;   // mean correlation to the held set
const VETO = 0.70;  // raw correlation with any single holding
const POOL = 50;    // how far down the ranking to consider
const WANT = 20;

/**
 * @param {{u: ArrayLike<number>}[]} rows Candidates in rank order; `u` is a
 *   centred, unit-L2-norm return vector, so uᵢ·uⱼ is the pair's correlation.
 * @param {{want?:number, avg?:number, veto?:number, held?:number[]}} [opts]
 *   `held` seeds the walk with candidates already owned: they constrain what
 *   can be added but are not returned again.
 * @returns {{picked:number[], skipped:{i:number,why:string,value:number,of:number}[], delta:number}}
 */
function fill(rows, opts = {}) {
  const want = opts.want ?? WANT;
  const avgMax = opts.avg ?? AVG;
  const veto = opts.veto ?? VETO;
  const held = (opts.held ?? []).slice();
  const n = rows.length;

  const picked = [];
  const skipped = [];
  if (!n) return { picked, skipped, delta: 0 };

  const raw = correlations(rows);
  const { corr, delta } = shrink(rows, raw);
  const basket = held.slice();

  for (let i = 0; i < n && basket.length < want; i++) {
    if (basket.includes(i)) continue;

    if (!basket.length) { picked.push(i); basket.push(i); continue; }

    // Duplicate test first, on raw correlations, so the reason reported is the
    // more specific of the two.
    let worst = -2;
    let twin = -1;
    for (const j of basket) {
      if (raw[i][j] > worst) { worst = raw[i][j]; twin = j; }
    }
    if (worst > veto) { skipped.push({ i, why: 'twin', value: worst, of: twin }); continue; }

    let mean = 0;
    for (const j of basket) mean += corr[i][j];
    mean /= basket.length;
    if (mean >= avgMax) { skipped.push({ i, why: 'overlap', value: mean, of: -1 }); continue; }

    picked.push(i);
    basket.push(i);
  }
  return { picked, skipped, delta };
}

/** Pairwise correlations — a dot product, since the vectors arrive unit-norm. */
function correlations(rows) {
  const n = rows.length;
  const T = rows[0].u.length;
  const C = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    C[i][i] = 1;
    for (let j = i + 1; j < n; j++) {
      let d = 0;
      for (let t = 0; t < T; t++) d += rows[i].u[t] * rows[j].u[t];
      C[i][j] = C[j][i] = d;
    }
  }
  return C;
}

/**
 * Ledoit & Wolf shrinkage toward constant correlation, on the candidates' own
 * matrix. The intensity is derived rather than tuned — a short or noisy sample
 * shrinks hard, a long clean one barely at all. Over 50 names and 252 days it
 * lands near 0.30; over 126 days near 0.44, the estimator noticing it has half
 * the evidence.
 *
 * Working on standardised series makes every variance 1, so the covariance
 * *is* the correlation matrix and the target is simply the average correlation
 * off the diagonal.
 */
function shrink(rows, C) {
  const n = rows.length;
  if (n < 3) return { corr: C, delta: 0 };
  const T = rows[0].u.length;

  // z has unit variance, so (1/T)·Σz_i z_j is the correlation directly
  const z = rows.map((r) => {
    const out = new Float64Array(T);
    const s = Math.sqrt(T);
    for (let t = 0; t < T; t++) out[t] = r.u[t] * s;
    return out;
  });

  let rbar = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { rbar += C[i][j]; pairs++; }
  rbar /= pairs;

  const piMat = Array.from({ length: n }, () => new Float64Array(n));
  let pi = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < T; t++) {
        const d = z[i][t] * z[j][t] - C[i][j];
        acc += d * d;
      }
      piMat[i][j] = piMat[j][i] = acc / T;
      pi += i === j ? piMat[i][j] : 2 * piMat[i][j];
    }
  }

  let rho = 0;
  for (let i = 0; i < n; i++) rho += piMat[i][i];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      let tii = 0;
      let tjj = 0;
      for (let t = 0; t < T; t++) {
        const cross = z[i][t] * z[j][t] - C[i][j];
        tii += (z[i][t] * z[i][t] - 1) * cross;
        tjj += (z[j][t] * z[j][t] - 1) * cross;
      }
      rho += (rbar / 2) * (tii / T + tjj / T);
    }
  }

  let gamma = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const f = i === j ? 1 : rbar;
      const d = f - C[i][j];
      gamma += d * d;
    }
  }

  const delta = gamma > 0 ? Math.max(0, Math.min(1, (pi - rho) / gamma / T)) : 0;
  if (delta <= 0) return { corr: C, delta: 0 };

  const out = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    out[i][i] = 1;
    for (let j = i + 1; j < n; j++) out[i][j] = out[j][i] = delta * rbar + (1 - delta) * C[i][j];
  }
  return { corr: out, delta };
}

/** Effective number of independent positions in an equally weighted set. */
function effectiveBets(rows, idx) {
  if (idx.length < 2) return idx.length;
  const T = rows[0].u.length;
  let total = 0;
  for (const a of idx) {
    for (const b of idx) {
      let d = 0;
      for (let t = 0; t < T; t++) d += rows[a].u[t] * rows[b].u[t];
      total += d;
    }
  }
  return total > 0 ? (idx.length * idx.length) / total : idx.length;
}

export { fill, correlations, shrink, effectiveBets, AVG, VETO, POOL, WANT };

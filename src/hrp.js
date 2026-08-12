// Hierarchical Risk Parity — López de Prado's allocator, plus the Ledoit-Wolf
// shrinkage that makes it usable on a short sample.
//
// This file is both a Node module (so `npm run test:hrp` can check the maths
// against cases with known answers) and the page's allocator: src/ranks-render.js
// inlines this source into the template, stripping only the export line at the
// bottom. Nothing here touches the DOM or imports anything.
//
// The pipeline, in the order it runs:
//
//   252 daily returns -> sample covariance -> Ledoit-Wolf shrinkage
//     -> correlation distance -> average-linkage tree -> quasi-diagonalisation
//     -> recursive bisection -> 10% cap -> normalise
//
// Why shrinkage: 252 observations across N names gives a sample covariance
// whose extreme eigenvalues are badly biased — the smallest are too small,
// which is exactly what an optimiser leans on. Shrinking toward a constant-
// correlation target pulls those back without discarding the structure HRP
// needs to cluster on.
//
// Why HRP rather than mean-variance: it never inverts the covariance matrix.
// It only ever compares two clusters at a time, so a near-singular sample —
// which two names correlated 0.97 will produce — degrades the answer instead
// of detonating it.

const EPS = 1e-12;

/**
 * @param {{u: ArrayLike<number>, sd: number}[]} rows
 *   `u` is a centred, unit-L2-norm return vector; `sd` its annualised
 *   volatility over the same window. Together they reconstruct the return
 *   series exactly (see `returnsMatrix`), which is what keeps the shipped page
 *   to one 336-character string per name instead of a covariance matrix.
 * @param {{cap?: number}} [opts]
 * @returns {{w: number[], delta: number, order: number[], capBound: boolean}}
 */
function hrpWeights(rows, opts = {}) {
  const cap = opts.cap ?? 0.10;
  const n = rows.length;
  if (n === 0) return { w: [], delta: 0, order: [], capBound: false };
  if (n === 1) return { w: [1], delta: 0, order: [0], capBound: false };

  const T = rows[0].u.length;
  const Y = returnsMatrix(rows, T);
  const S = sampleCovariance(Y, T);
  const { sigma, delta } = shrinkCovariance(Y, S, T);

  const { order } = cluster(distanceMatrix(sigma), opts.linkage ?? 'average');
  const raw = bisect(sigma, order);
  const { w, bound } = capAndNormalise(raw, cap);

  return { w, delta, order, capBound: bound };
}

/**
 * Rebuilds centred returns scaled so that (1/T)·YᵀY is the *annualised*
 * covariance. A unit-norm vector satisfies Σₜu²=1, so y = u·σ·√T gives
 * (1/T)Σₜ yᵢₜyⱼₜ = σᵢσⱼρᵢⱼ directly.
 */
function returnsMatrix(rows, T) {
  return rows.map((r) => {
    const scale = Math.max(r.sd, EPS) * Math.sqrt(T);
    const y = new Float64Array(T);
    for (let t = 0; t < T; t++) y[t] = r.u[t] * scale;
    return y;
  });
}

/** (1/T)·YᵀY. The rows arrive centred, so no mean is removed here. */
function sampleCovariance(Y, T) {
  const n = Y.length;
  const S = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < T; t++) acc += Y[i][t] * Y[j][t];
      S[i][j] = S[j][i] = acc / T;
    }
  }
  return S;
}

/**
 * Ledoit & Wolf (2003), "Honey, I Shrunk the Sample Covariance Matrix":
 * Σ̂ = δF + (1−δ)S, where F is the constant-correlation target — every sample
 * variance kept, every correlation replaced by the average one — and δ is
 * chosen analytically to minimise expected squared error.
 *
 * δ = ((π̂ − ρ̂) / γ̂) / T, clipped to [0,1]:
 *   π̂  how noisy the sample covariance entries are
 *   ρ̂  how much that noise is shared with the target
 *   γ̂  how wrong the target is (its squared distance from S)
 *
 * So a sample that is mostly noise, or a target that happens to be close,
 * shrinks hard; a long clean sample against a badly-fitting target barely
 * shrinks at all. Nothing is tuned by hand.
 */
function shrinkCovariance(Y, S, T) {
  const n = S.length;
  if (n < 2) return { sigma: S, delta: 0 };

  const sd = new Float64Array(n);
  for (let i = 0; i < n; i++) sd[i] = Math.sqrt(Math.max(S[i][i], EPS));

  let rbar = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) { rbar += S[i][j] / (sd[i] * sd[j]); pairs++; }
  }
  rbar = pairs ? rbar / pairs : 0;

  // π̂ᵢⱼ = asymptotic variance of √T·Sᵢⱼ, estimated from the sample's own
  // fourth moments — this is what makes the intensity adapt to fat tails.
  const piMat = Array.from({ length: n }, () => new Float64Array(n));
  let pi = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let acc = 0;
      for (let t = 0; t < T; t++) {
        const d = Y[i][t] * Y[j][t] - S[i][j];
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
        const cross = Y[i][t] * Y[j][t] - S[i][j];
        tii += (Y[i][t] * Y[i][t] - S[i][i]) * cross;
        tjj += (Y[j][t] * Y[j][t] - S[j][j]) * cross;
      }
      tii /= T;
      tjj /= T;
      rho += (rbar / 2) * ((sd[j] / sd[i]) * tii + (sd[i] / sd[j]) * tjj);
    }
  }

  let gamma = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const f = i === j ? S[i][i] : rbar * sd[i] * sd[j];
      const d = f - S[i][j];
      gamma += d * d;
    }
  }

  const delta = gamma > EPS ? Math.max(0, Math.min(1, (pi - rho) / gamma / T)) : 0;
  if (delta <= 0) return { sigma: S, delta: 0 };

  const sigma = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const f = i === j ? S[i][i] : rbar * sd[i] * sd[j];
      sigma[i][j] = delta * f + (1 - delta) * S[i][j];
    }
  }
  return { sigma, delta };
}

/**
 * d = √(½(1−ρ)) — a proper metric on correlation: identical names sit at 0,
 * uncorrelated at 0.707, perfectly opposed at 1.
 */
function distanceMatrix(sigma) {
  const n = sigma.length;
  const sd = new Float64Array(n);
  for (let i = 0; i < n; i++) sd[i] = Math.sqrt(Math.max(sigma[i][i], EPS));
  const D = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = Math.max(-1, Math.min(1, sigma[i][j] / (sd[i] * sd[j])));
      D[i][j] = D[j][i] = Math.sqrt(Math.max(0, 0.5 * (1 - r)));
    }
  }
  return D;
}

/**
 * Agglomerative clustering. Returns both the tree and its leaf order —
 * concatenating each merge's members *is* the dendrogram's leaf order, so
 * quasi-diagonalisation falls out of the tree rather than needing a second
 * pass: correlated names end up adjacent and the covariance matrix read in this
 * order is close to block-diagonal.
 *
 * Average linkage (UPGMA) rather than the single linkage of the original HRP
 * paper. Single linkage merges on the *nearest* pair, so one incidentally
 * correlated pair welds two otherwise unrelated groups together; on real equity
 * correlations it chains, and a chained tree has no cluster structure left for
 * the bisection to use. Average linkage asks whether two groups are related on
 * the whole, which is the question being posed here.
 */
function cluster(D, method = 'average') {
  const n = D.length;
  if (n === 0) return { tree: null, order: [] };
  if (n === 1) return { tree: { leaf: 0, members: [0] }, order: [0] };

  let nodes = Array.from({ length: n }, (_, i) => ({ leaf: i, members: [i] }));
  let dist = D.map((row) => Array.from(row));

  while (nodes.length > 1) {
    let best = Infinity;
    let bi = 0;
    let bj = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        if (dist[i][j] < best) { best = dist[i][j]; bi = i; bj = j; }
      }
    }

    const a = nodes[bi];
    const b = nodes[bj];
    const merged = { left: a, right: b, members: a.members.concat(b.members) };
    const na = a.members.length;
    const nb = b.members.length;
    const linked = nodes.map((_, k) => (method === 'single'
      ? Math.min(dist[bi][k], dist[bj][k])
      : (na * dist[bi][k] + nb * dist[bj][k]) / (na + nb)));

    const keep = nodes.map((_, k) => k).filter((k) => k !== bi && k !== bj);
    const nextDist = keep.map((p) => keep.map((q) => dist[p][q]));
    const row = keep.map((k) => linked[k]);
    for (let i = 0; i < nextDist.length; i++) nextDist[i].push(row[i]);
    nextDist.push([...row, 0]);

    nodes = keep.map((k) => nodes[k]);
    nodes.push(merged);
    dist = nextDist;
  }
  return { tree: nodes[0], order: nodes[0].members };
}

/**
 * Recursive bisection down the seriated order: halve the list, hand weight to
 * the two halves in inverse proportion to their risk, recurse. Because the
 * order is quasi-diagonalised, each half is made of names that belong together,
 * so a crowded cluster competes with itself before its total competes with the
 * rest of the book.
 *
 * Two choices here were settled by measurement rather than by the paper, both
 * against the real 1,517-name universe:
 *
 * **Halving by position, not at the dendrogram's merge points.** Splitting
 * where the tree splits sounds strictly better and is much worse. Inside a
 * group with no real structure the tree is decided by noise, and an unbalanced
 * tree makes weights decay geometrically — six statistically identical names
 * came out between 1.9% and 26.8%, and three semis with the same 60% volatility
 * landed on 0.1%, 0.2% and 0.3%. Scoring cuts by how well they separate the two
 * sides fixes the synthetic case and fails the real one: on live correlations
 * it latches onto noise and reaches a 293:1 spread. Positional halving is
 * balanced by construction, and tightening the boundary test far enough to be
 * safe just turns it back into positional halving.
 *
 * **Inverse volatility between branches, where López de Prado uses inverse
 * variance.** Inverse variance is a minimum-variance step, not a risk-parity
 * one: equalising the two branches' risk contribution calls for w ∝ 1/σ.
 * Measured, the variance version piles into whatever is quietest — an
 * eight-name mega-cap basket came out 44.5% in one name at a 31:1 spread,
 * against 28.9% and 5.5:1 here — while diversifying no better.
 */
function bisect(sigma, order) {
  const w = new Array(sigma.length).fill(0);
  if (!order.length) return w;

  const walk = (seg, weight) => {
    if (seg.length === 1) { w[seg[0]] = weight; return; }
    const mid = seg.length >> 1;
    const left = seg.slice(0, mid);
    const right = seg.slice(mid);
    const sl = Math.sqrt(clusterVariance(sigma, left));
    const sr = Math.sqrt(clusterVariance(sigma, right));
    const alpha = sl + sr > EPS ? 1 - sl / (sl + sr) : 0.5;
    walk(left, weight * alpha);
    walk(right, weight * (1 - alpha));
  };
  walk(order, 1);
  return w;
}

/** Variance of a cluster held at inverse-variance weights. */
function clusterVariance(sigma, members) {
  const inv = members.map((i) => 1 / Math.max(sigma[i][i], EPS));
  const total = inv.reduce((a, b) => a + b, 0);
  const w = inv.map((x) => x / total);
  let v = 0;
  for (let a = 0; a < members.length; a++) {
    for (let b = 0; b < members.length; b++) v += w[a] * w[b] * sigma[members[a]][members[b]];
  }
  return v;
}

/**
 * Caps each weight and pushes the overflow onto the names still under the cap,
 * in proportion to what they already hold — repeating, because absorbing
 * overflow can lift a name over the line itself.
 *
 * A cap only means something above 1/n: eleven names can be held under 10%
 * each, ten can only be held at *exactly* 10% each, and nine cannot be held
 * under it at all. Below that line the cap is left off rather than quietly
 * flattening the basket to equal weight.
 */
function capAndNormalise(weights, cap) {
  const n = weights.length;
  let w = normalise(weights);
  if (!(cap > 0) || cap * n <= 1 + 1e-9) return { w, bound: false };

  const before = Math.max(...w);
  for (let pass = 0; pass < 200; pass++) {
    let excess = 0;
    const free = [];
    for (let i = 0; i < n; i++) {
      if (w[i] > cap + 1e-12) { excess += w[i] - cap; w[i] = cap; }
      else free.push(i);
    }
    if (excess <= 1e-12 || !free.length) break;

    const pool = free.reduce((t, i) => t + w[i], 0);
    if (pool > EPS) for (const i of free) w[i] += (excess * w[i]) / pool;
    else for (const i of free) w[i] += excess / free.length;
  }
  return { w: normalise(w), bound: before > cap + 1e-9 };
}

function normalise(weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > EPS)) return weights.map(() => 1 / weights.length);
  return weights.map((x) => x / total);
}

/**
 * Whole units that sum to exactly `total` — largest remainder, so 100% of a
 * basket reads as 100 and a $10,000 portfolio adds up to $10,000. Rounding each
 * row on its own does not, and a column of weights is a thing readers add up.
 */
function apportion(weights, total) {
  const raw = weights.map((w) => w * total);
  const base = raw.map(Math.floor);
  let left = Math.round(total - base.reduce((a, b) => a + b, 0));
  const order = raw
    .map((v, i) => [v - base[i], i])
    .sort((a, b) => b[0] - a[0]);
  for (let k = 0; k < order.length && left > 0; k++, left--) base[order[k][1]]++;
  return base;
}

export { hrpWeights, shrinkCovariance, sampleCovariance, distanceMatrix, cluster, bisect, capAndNormalise, apportion, normalise };

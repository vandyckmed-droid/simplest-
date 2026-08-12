// Checks the HRP allocator against cases whose answers are known by hand.
//
//   npm run test:hrp
//
// Every case is deterministic — the noise comes from a seeded PRNG, so a
// failure here is a real change in the maths and not a bad draw.

import assert from 'node:assert/strict';
import { hrpWeights, apportion, capAndNormalise, cluster, shrinkCovariance, sampleCovariance } from './hrp.js';

const T = 252;
const DAILY = 0.02; // ~32% annualised, so the vols in these tests look like real ones

let passed = 0;
function check(label, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${label}`);
  } catch (err) {
    console.error(`  FAIL ${label}\n       ${err.message}`);
    process.exitCode = 1;
  }
}

/** mulberry32 — small, seeded, good enough for test fixtures. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normals(next, n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(next(), 1e-12);
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    out[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) out[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return out;
}

/** A raw return series -> the {u, sd} pair the page actually ships. */
function toRow(returns) {
  const mean = returns.reduce((s, x) => s + x, 0) / returns.length;
  const centred = Array.from(returns, (x) => x - mean);
  const norm = Math.sqrt(centred.reduce((s, x) => s + x * x, 0));
  const sd = (norm / Math.sqrt(returns.length)) * Math.sqrt(252);
  return { u: centred.map((x) => x / norm), sd };
}

/** Blocks of `size` names, correlated `rho` inside and independent across. */
function blocks(seed, sizes, rho, vol = DAILY) {
  const next = rng(seed);
  const rows = [];
  for (const size of sizes) {
    const f = normals(next, T);
    for (let k = 0; k < size; k++) {
      const e = normals(next, T);
      const r = new Float64Array(T);
      for (let t = 0; t < T; t++) r[t] = vol * (Math.sqrt(rho) * f[t] + Math.sqrt(1 - rho) * e[t]);
      rows.push(toRow(r));
    }
  }
  return rows;
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const close = (a, b, tol, what) =>
  assert.ok(Math.abs(a - b) <= tol, `${what}: ${a.toFixed(4)} vs ${b.toFixed(4)} (±${tol})`);

console.log('hrp');

// Two exactly-orthogonal names reduce HRP to inverse volatility, which is
// hand-computable: 10% and 20% vol -> 1/0.1 : 1/0.2 -> 2:1 -> 67/33.
check('orthogonal pair falls back to inverse volatility', () => {
  const a = new Array(T).fill(0).map((_, t) => (t % 2 ? -1 : 1) / Math.sqrt(T));
  const b = new Array(T).fill(0).map((_, t) => (t < T / 2 ? 1 : -1) / Math.sqrt(T));
  close(sum(a.map((x, i) => x * b[i])), 0, 1e-12, 'orthogonality');

  const { w, delta } = hrpWeights([{ u: a, sd: 0.10 }, { u: b, sd: 0.20 }]);
  close(delta, 0, 1e-12, 'shrinkage on an already-diagonal sample');
  close(w[0], 2 / 3, 1e-9, 'low-vol weight');
  close(w[1], 1 / 3, 1e-9, 'high-vol weight');
});

// The headline property: a crowded cluster gets sized down, and the average
// name inside it carries less than the average name outside. Volatilities are
// identical throughout these fixtures, so inverse-vol hands the crowded side
// its full head-count share and every point of difference comes from the
// clustering. The effect is real but not dramatic — positional halving only
// lands on the cluster boundary when the boundary is near a midpoint, which is
// the price of the stability that choice buys elsewhere.
check('a crowded cluster is sized below its head count', () => {
  for (const [big, small] of [[6, 2], [8, 4], [9, 3]]) {
    const rows = blocks(7, [big, small], 0.9);
    const { w } = hrpWeights(rows, { cap: 0 });
    close(sum(w), 1, 1e-12, `${big}+${small} sum`);

    const inv = rows.map((r) => 1 / r.sd);
    const it = sum(inv);
    const ivShare = sum(inv.slice(0, big)) / it;
    const share = sum(w.slice(0, big));
    assert.ok(share < ivShare - 0.02,
      `${big}+${small}: crowded cluster took ${(share * 100).toFixed(1)}%, inverse-vol gives it ${(ivShare * 100).toFixed(1)}%`);
    assert.ok(share / big < (1 - share) / small,
      `${big}+${small}: the average crowded name should carry less than the average lone one`);
  }
});

check('seriation puts cluster members adjacent', () => {
  const rows = blocks(11, [4, 4], 0.9);
  const { order } = hrpWeights(rows, { cap: 0 });
  const side = order.map((i) => (i < 4 ? 0 : 1));
  const flips = side.slice(1).filter((s, i) => s !== side[i]).length;
  assert.equal(flips, 1, `expected one boundary in ${order.join(',')}`);
});

check('shrinkage intensity stays in [0,1] and softens correlations', () => {
  const rows = blocks(3, [5, 5], 0.85);
  const Y = rows.map((r) => Float64Array.from(r.u, (x) => x * r.sd * Math.sqrt(T)));
  const S = sampleCovariance(Y, T);
  const { sigma, delta } = shrinkCovariance(Y, S, T);
  assert.ok(delta > 0 && delta < 1, `delta ${delta}`);

  const corr = (M, i, j) => M[i][j] / Math.sqrt(M[i][i] * M[j][j]);
  assert.ok(corr(sigma, 0, 1) < corr(S, 0, 1), 'a high in-block correlation should be pulled down');
  assert.ok(corr(sigma, 0, 5) > corr(S, 0, 5), 'a near-zero cross-block correlation should be pulled up');
  for (let i = 0; i < 10; i++) close(sigma[i][i], S[i][i], 1e-12, 'variances are kept');
});

check('a longer sample shrinks less', () => {
  const short = hrpWeights(blocks(5, [4, 4], 0.7).map((r) => ({ u: r.u.slice(0, 60), sd: r.sd })), { cap: 0 });
  const long = hrpWeights(blocks(5, [4, 4], 0.7), { cap: 0 });
  assert.ok(short.delta > long.delta, `60 obs delta ${short.delta.toFixed(3)} should exceed 252 obs delta ${long.delta.toFixed(3)}`);
});

check('the 10% cap binds above ten names and normalises', () => {
  const rows = blocks(21, [15], 0.2);
  rows[0].sd = 0.02; // one very quiet name that HRP would otherwise pile into
  const { w, capBound } = hrpWeights(rows);
  assert.ok(capBound, 'cap should report as binding');
  close(sum(w), 1, 1e-12, 'sum');
  for (const x of w) assert.ok(x <= 0.10 + 1e-9, `weight ${(x * 100).toFixed(2)}% breached the cap`);
});

check('the cap stays off at ten names or fewer', () => {
  // Ten names under a 10% cap can only be equal-weighted, and nine cannot meet
  // it at all — so below eleven the cap is left off rather than flattening.
  for (const n of [4, 9, 10]) {
    const rows = blocks(31, [n], 0.3);
    rows[0].sd = 0.02;
    const { w, capBound } = hrpWeights(rows);
    assert.equal(capBound, false, `n=${n} should not report a binding cap`);
    close(sum(w), 1, 1e-12, `n=${n} sum`);
    assert.ok(Math.max(...w) > 0.10, `n=${n} should be free to exceed 10%`);
  }
  const eleven = hrpWeights(blocks(31, [11], 0.3).map((r, i) => (i ? r : { ...r, sd: 0.02 })));
  assert.ok(Math.max(...eleven.w) <= 0.10 + 1e-9, 'eleven names should be capped');
});

check('degenerate baskets', () => {
  assert.deepEqual(hrpWeights([]).w, []);
  assert.deepEqual(hrpWeights([{ u: new Array(T).fill(1 / Math.sqrt(T)), sd: 0.3 }]).w, [1]);

  // Two names correlated 0.999 — the case that makes mean-variance detonate.
  const [a] = blocks(2, [1], 0);
  const b = { u: a.u.map((x, i) => x + (i % 2 ? 1e-3 : -1e-3)), sd: a.sd };
  const norm = Math.sqrt(sum(b.u.map((x) => x * x)));
  b.u = b.u.map((x) => x / norm);
  const { w } = hrpWeights([a, b]);
  close(sum(w), 1, 1e-9, 'sum');
  for (const x of w) assert.ok(Number.isFinite(x) && x > 0, 'weights stay finite and positive');
});

check('capAndNormalise handles an all-in-one basket', () => {
  const { w } = capAndNormalise([1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 0.10);
  close(sum(w), 1, 1e-12, 'sum');
  for (const x of w) assert.ok(x <= 0.10 + 1e-9, 'cap respected');
});

check('apportion sums exactly', () => {
  for (const [total, n, seed] of [[100, 7, 1], [10000, 23, 2], [100, 3, 3], [10000, 1, 4]]) {
    const next = rng(seed);
    const raw = Array.from({ length: n }, () => next() + 0.01);
    const t = sum(raw);
    const parts = apportion(raw.map((x) => x / t), total);
    assert.equal(sum(parts), total, `${n} rows over ${total}`);
    for (const p of parts) assert.ok(p >= 0, 'no negative parts');
  }
});

check('cluster is stable on a trivial input', () => {
  assert.deepEqual(cluster([]).order, []);
  assert.deepEqual(cluster([[0]]).order, [0]);
});

// The property that the cut rule exists for: inside a group with no structure,
// the split has to fall in the middle rather than wherever noise put the tree.
// Six identical names bisected on tree merge points came out 1.9%–26.8%.
check('a structureless cluster is split evenly', () => {
  const rows = blocks(17, [8], 0.9);
  const { w } = hrpWeights(rows, { cap: 0 });
  close(sum(w), 1, 1e-12, 'sum');
  const spread = Math.max(...w) / Math.min(...w);
  assert.ok(spread < 1.35, `identical names spread ${spread.toFixed(2)}:1`);
});

check('average linkage seriates blocks contiguously', () => {
  const rows = blocks(13, [8, 8], 0.55);
  const { order } = cluster(distanceOf(rows), 'average');
  const side = order.map((i) => (i < 8 ? 0 : 1));
  const flips = side.slice(1).filter((s, i) => s !== side[i]).length;
  assert.equal(flips, 1, `expected one boundary in ${order.join(',')}`);
});

function distanceOf(rows) {
  const Y = rows.map((r) => Float64Array.from(r.u, (x) => x * r.sd * Math.sqrt(T)));
  const S = sampleCovariance(Y, T);
  const { sigma } = shrinkCovariance(Y, S, T);
  const n = sigma.length;
  const D = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const r = sigma[i][j] / Math.sqrt(sigma[i][i] * sigma[j][j]);
      D[i][j] = D[j][i] = Math.sqrt(Math.max(0, 0.5 * (1 - r)));
    }
  }
  return D;
}

console.log(`\n${passed} checks passed`);

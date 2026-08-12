// Checks the basket filler, including against the live top 50.
//
//   npm run test:select

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fill, correlations, shrink, effectiveBets, AVG, VETO } from './select.js';

let passed = 0;
function check(label, fn) {
  try { fn(); passed++; console.log(`  ok   ${label}`); }
  catch (err) { console.error(`  FAIL ${label}\n       ${err.message}`); process.exitCode = 1; }
}

const T = 252;
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
  const o = new Float64Array(n);
  for (let i = 0; i < n; i += 2) {
    const u = Math.max(next(), 1e-12);
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    o[i] = r * Math.cos(2 * Math.PI * v);
    if (i + 1 < n) o[i + 1] = r * Math.sin(2 * Math.PI * v);
  }
  return o;
}
const unit = (r) => {
  const m = r.reduce((s, x) => s + x, 0) / r.length;
  const c = Array.from(r, (x) => x - m);
  const n = Math.sqrt(c.reduce((s, x) => s + x * x, 0));
  return { u: c.map((x) => x / n) };
};
/** `sizes` blocks, correlated `rho` within and independent across. */
function blocks(seed, sizes, rho) {
  const next = rng(seed);
  const out = [];
  for (const size of sizes) {
    const f = normals(next, T);
    for (let k = 0; k < size; k++) {
      const e = normals(next, T);
      const r = new Float64Array(T);
      for (let t = 0; t < T; t++) r[t] = Math.sqrt(rho) * f[t] + Math.sqrt(1 - rho) * e[t];
      out.push(unit(r));
    }
  }
  return out;
}

console.log('select');

check('an all-independent pool is taken straight down the ranking', () => {
  const rows = blocks(3, new Array(30).fill(1), 0);
  const { picked } = fill(rows, { want: 10 });
  assert.deepEqual(picked, [0,1,2,3,4,5,6,7,8,9]);
});

check('a near-duplicate is vetoed and named', () => {
  const rows = blocks(5, new Array(12).fill(1), 0);
  rows[3] = { u: rows[0].u.slice() };          // an exact twin of the leader
  const { picked, skipped } = fill(rows, { want: 6 });
  assert.ok(!picked.includes(3), 'the twin should not be picked');
  const s = skipped.find((x) => x.i === 3);
  assert.equal(s.why, 'twin');
  assert.equal(s.of, 0, 'and should name what it duplicates');
  assert.ok(s.value > 0.99, `reported ${s.value}`);
});

check('diffuse overlap is caught even with no single twin', () => {
  // one block of eight moving together at 0.5 — no pair near the veto, but
  // after a few are held the mean climbs past the threshold
  const rows = blocks(7, [8, 8], 0.5);
  const { picked } = fill(rows, { want: 8 });
  const fromFirst = picked.filter((i) => i < 8).length;
  assert.ok(fromFirst < 8, `took ${fromFirst} of the correlated block`);
  assert.ok(picked.some((i) => i >= 8), 'and should reach past it');
});

check('it never pads to the target', () => {
  // twelve copies of one thing: after the first, everything is a twin
  const base = blocks(11, [1], 0);
  const rows = Array.from({ length: 12 }, (_, i) =>
    i === 0 ? base[0] : { u: base[0].u.slice() });
  const { picked } = fill(rows, { want: 12 });
  assert.equal(picked.length, 1, `returned ${picked.length}, so it padded`);
});

check('held names constrain the walk without being returned', () => {
  const rows = blocks(13, new Array(12).fill(1), 0);
  rows[5] = { u: rows[2].u.slice() };
  const { picked } = fill(rows, { want: 5, held: [2] });
  assert.ok(!picked.includes(2), 'a held name is not offered again');
  assert.ok(!picked.includes(5), 'and still blocks its duplicate');
  assert.equal(picked.length, 4, 'the held name counts toward the target');
});

check('shrinkage intensity responds to sample length', () => {
  const rows = blocks(17, [10, 10], 0.4);
  const long = shrink(rows, correlations(rows)).delta;
  const half = rows.map((r) => ({ u: r.u.slice(0, 126) }));
  const short = shrink(half, correlations(half)).delta;
  assert.ok(long > 0 && long < 1, `delta ${long}`);
  assert.ok(short > long, `126 obs (${short.toFixed(3)}) should shrink harder than 252 (${long.toFixed(3)})`);
});

check('thresholds are honoured exactly', () => {
  const rows = blocks(19, [6, 6, 6], 0.55);
  const { picked } = fill(rows, { want: 12, avg: 0.05 });
  const C = correlations(rows);
  // every picked name was under the mean bar against the ones before it
  for (let k = 1; k < picked.length; k++) {
    const prior = picked.slice(0, k);
    const { corr } = shrink(rows, C);
    const mean = prior.reduce((s, j) => s + corr[picked[k]][j], 0) / prior.length;
    assert.ok(mean < 0.05, `${picked[k]} entered at mean ${mean.toFixed(4)}`);
  }
});

check('degenerate inputs', () => {
  assert.deepEqual(fill([], { want: 5 }).picked, []);
  assert.deepEqual(fill(blocks(23, [1], 0), { want: 5 }).picked, [0]);
});

// ---- against the live universe ----
const data = JSON.parse(await readFile(new URL('../data/ranks.json', import.meta.url), 'utf8'));
if (data.stocks[0]?.corr) {
  const decode = (b64) => {
    const buf = Buffer.from(b64, 'base64');
    const v = Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    const c = v.map((x) => x - m);
    const n = Math.sqrt(c.reduce((s, x) => s + x * x, 0));
    return c.map((x) => x / n);
  };
  const top = data.stocks.slice(0, 50).map((s) => ({ u: decode(s.corr), symbol: s.symbol }));

  check('the live top 50 fills to 20 and diversifies', () => {
    const { picked, delta } = fill(top, { want: 20 });
    assert.equal(picked.length, 20, `filled ${picked.length}`);
    assert.ok(delta > 0.2 && delta < 0.45, `shrinkage delta ${delta.toFixed(3)} is off the measured range`);

    const before = effectiveBets(top, [...Array(20).keys()]);
    const after = effectiveBets(top, picked);
    assert.ok(after > before * 1.3,
      `effective bets ${after.toFixed(1)} vs ${before.toFixed(1)} for the top 20 — expected a clear gain`);
    console.log(`       ${picked.map((i) => top[i].symbol).join(' ')}`);
    console.log(`       effective bets ${after.toFixed(1)} against ${before.toFixed(1)} taking rank 1-20, delta ${delta.toFixed(3)}`);
  });
}

console.log(`\n${passed} checks passed`);

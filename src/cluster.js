// k-medoids over the fund correlation matrix, run at build time.
//
// The page ships the grouping rather than computing it: PAM is O(k·N²) per swap
// pass and there is nothing about it a reader can change, so it belongs in the
// build the same way the scores do.
//
// The six steps, in order:
//   1. synchronised daily returns — the shipped vectors are the same 252
//      sessions for every fund, so this is true by construction
//   2. the N x N correlation matrix, a dot product of unit-norm vectors
//   3. correlation -> distance
//   4. PAM: greedy BUILD, then exhaustive SWAP until no swap improves
//   5. the caller asks for several k
//   6. every fund sits with its nearest medoid, and the medoids move until the
//      total within-group distance stops falling

/** sqrt((1-r)/2): a proper metric — identical 0, uncorrelated 0.707, opposed 1. */
const distance = (r) => Math.sqrt(Math.max(0, (1 - r) / 2));

/** The shipped base64 int8 vector, back to unit norm. */
export function decodeVector(b64, length) {
  const bytes = Buffer.from(b64, 'base64');
  const v = Array.from(bytes, (x) => (x > 127 ? x - 256 : x)).slice(0, length);
  const mean = v.reduce((t, x) => t + x, 0) / v.length;
  const centred = v.map((x) => x - mean);
  const norm = Math.sqrt(centred.reduce((t, x) => t + x * x, 0)) || 1;
  return centred.map((x) => x / norm);
}

function matrices(vectors) {
  const N = vectors.length;
  const R = Array.from({ length: N }, () => new Float64Array(N));
  const D = Array.from({ length: N }, () => new Float64Array(N));
  for (let i = 0; i < N; i++) {
    R[i][i] = 1;
    for (let j = i + 1; j < N; j++) {
      let d = 0;
      for (let t = 0; t < vectors[i].length; t++) d += vectors[i][t] * vectors[j][t];
      R[i][j] = R[j][i] = d;
      D[i][j] = D[j][i] = distance(d);
    }
  }
  return { R, D };
}

function pam(D, N, k) {
  const cost = (med) => {
    let total = 0;
    for (let i = 0; i < N; i++) {
      let best = Infinity;
      for (const m of med) if (D[i][m] < best) best = D[i][m];
      total += best;
    }
    return total;
  };

  // BUILD: the most central point, then whichever addition drops the cost most.
  const med = [];
  let seed = 0;
  let bestSum = Infinity;
  for (let i = 0; i < N; i++) {
    let t = 0;
    for (let j = 0; j < N; j++) t += D[i][j];
    if (t < bestSum) { bestSum = t; seed = i; }
  }
  med.push(seed);
  while (med.length < k) {
    let best = Infinity;
    let pickIdx = -1;
    for (let i = 0; i < N; i++) {
      if (med.includes(i)) continue;
      const c = cost([...med, i]);
      if (c < best) { best = c; pickIdx = i; }
    }
    med.push(pickIdx);
  }

  // SWAP: every medoid against every non-medoid, take the best improvement,
  // repeat until none improves. The pass cap is a guard, not a schedule — this
  // converges in well under ten passes at these sizes.
  let current = cost(med);
  for (let pass = 0; pass < 200; pass++) {
    let best = current;
    let swap = null;
    for (let x = 0; x < med.length; x++) {
      for (let h = 0; h < N; h++) {
        if (med.includes(h)) continue;
        const trial = [...med];
        trial[x] = h;
        const c = cost(trial);
        if (c < best - 1e-12) { best = c; swap = [x, h]; }
      }
    }
    if (!swap) break;
    med[swap[0]] = swap[1];
    current = best;
  }

  const label = new Int32Array(N);
  for (let i = 0; i < N; i++) {
    let best = Infinity;
    for (let x = 0; x < med.length; x++) if (D[i][med[x]] < best) { best = D[i][med[x]]; label[i] = x; }
  }
  return { med, label, cost: current };
}

/** Mean silhouette — how much better each fund fits its own group than the next. */
function silhouette(D, N, label, k) {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const sums = new Float64Array(k);
    const counts = new Int32Array(k);
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      sums[label[j]] += D[i][j];
      counts[label[j]]++;
    }
    const own = label[i];
    if (!counts[own]) continue; // a group of one has nothing to be similar to
    const a = sums[own] / counts[own];
    let b = Infinity;
    for (let x = 0; x < k; x++) if (x !== own && counts[x]) b = Math.min(b, sums[x] / counts[x]);
    if (Number.isFinite(b)) total += (b - a) / Math.max(a, b);
  }
  return total / N;
}

/**
 * Colour slots, assigned once against a reference run and inherited by the
 * others.
 *
 * The obvious rule — slot by size rank — repaints the whole page every time the
 * group count changes, because the second-largest group at k=8 is rarely the
 * second-largest at k=10. Anchoring on the reference partition instead means a
 * colour stays with its group, and raising k reads as one group splitting.
 *
 * Eight hues is the whole palette; past that a group takes the neutral grey and
 * position alone tells it from its neighbour. A ninth hue is never generated.
 */
const SLOTS = 8;

function assignSlots(runs, referenceK) {
  const ref = runs.get(referenceK).groups;
  ref.forEach((g, i) => { g.slot = i < SLOTS ? i : -1; });

  for (const [k, run] of runs) {
    if (k === referenceK) continue;
    const claimed = new Set();
    const matched = new Map();
    for (const g of run.groups) { // largest first: the big groups claim their colour
      const mine = new Set(g.members);
      let best = -1;
      let overlap = 0;
      ref.forEach((r, i) => {
        if (claimed.has(i) || r.slot < 0) return;
        const n = r.members.reduce((t, x) => t + (mine.has(x) ? 1 : 0), 0);
        if (n > overlap) { overlap = n; best = i; }
      });
      if (best >= 0) { matched.set(g, best); claimed.add(best); }
    }
    const keep = run.groups.slice(0, SLOTS);
    const free = [...Array(SLOTS).keys()].filter((i) => !keep.some((g) => matched.get(g) === i));
    for (const g of run.groups) {
      if (!keep.includes(g)) g.slot = -1;
      else g.slot = matched.has(g) ? matched.get(g) : free.shift();
    }
  }
}

/**
 * Group `vectors` at each k in `ks`.
 *
 * Returns `{ [k]: { cost, sil, groups: [{ slot, medoid, rho, members }] } }`,
 * groups ordered largest first and members carrying indices into `vectors`.
 */
export function clusters(vectors, ks, referenceK = ks[Math.floor(ks.length / 2)]) {
  const N = vectors.length;
  const { R, D } = matrices(vectors);
  const runs = new Map();

  for (const k of ks) {
    const { med, label, cost } = pam(D, N, k);
    const groups = med.map((medoid, x) => ({
      medoid,
      members: [...Array(N).keys()].filter((i) => label[i] === x),
    }));
    for (const g of groups) {
      let total = 0;
      let pairs = 0;
      for (const a of g.members) for (const b of g.members) if (a < b) { total += R[a][b]; pairs++; }
      g.rho = pairs ? total / pairs : 1;
    }
    groups.sort((a, b) => b.members.length - a.members.length);
    runs.set(k, { cost, sil: silhouette(D, N, label, k), groups });
  }

  assignSlots(runs, referenceK);
  return Object.fromEntries(runs);
}

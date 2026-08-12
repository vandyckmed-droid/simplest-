// Volatility-adjusted momentum on daily adjusted closes.
//
// A window is defined by two edges: how far back it opens (the **lookback**)
// and how far short of today it closes (the **skip**). Both are settings on the
// page, so every name is measured at each combination and ships all of them.
//
// The skip is the "-1" in 12-1 / 6-1: the standard way to keep short-term
// reversal out of a momentum signal, since the last few weeks of a stock's
// return tend to mean-revert. It is worth being able to switch off — a name can
// rank badly on a window that ends a month ago while having turned since, which
// is a fact about the measurement rather than about the name.

export const TRADING_DAYS_PER_YEAR = 252;

/** Window openings, longest first: ~12 months and ~6 months. */
export const LOOKBACKS = [252, 126];

/** Window closings, as 0% / 50% / 100% of a trading month. */
export const SKIPS = [0, 10, 21];

/** 100% — one full month skipped, the conventional momentum definition. */
export const DEFAULT_SKIP = 2;

/** Where `[skip][lookback]` sits in the flat arrays `score` returns. */
export const at = (skip, lookback) => skip * LOOKBACKS.length + lookback;

/**
 * @param {number[]} closes Adjusted closes, oldest first.
 * @param {number} lookback Bars back from today where the window opens.
 * @param {number} skip Bars short of today where it closes.
 */
function measure(closes, lookback, skip) {
  const n = closes.length;
  const end = n - 1 - skip; // index of the window's last close
  const start = n - 1 - lookback; // index of the window's first close
  if (start < 0 || end <= start) return null;

  const pStart = closes[start];
  const pEnd = closes[end];
  if (!(pStart > 0) || !(pEnd > 0)) return null;

  const logReturn = Math.log(pEnd / pStart);

  // Daily log returns inside the same window drive the volatility estimate, so
  // the numerator and denominator describe the identical stretch of tape.
  const daily = [];
  for (let i = start + 1; i <= end; i++) {
    const a = closes[i - 1];
    const b = closes[i];
    if (a > 0 && b > 0) daily.push(Math.log(b / a));
  }
  if (daily.length < 20) return null;

  const mean = daily.reduce((s, x) => s + x, 0) / daily.length;
  const variance = daily.reduce((s, x) => s + (x - mean) ** 2, 0) / (daily.length - 1);
  const annVol = Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
  if (!(annVol > 0)) return null;

  // Annualise the window return so every combination is on one scale, then
  // divide by annualised volatility: a Sharpe-like, unitless momentum score.
  const years = daily.length / TRADING_DAYS_PER_YEAR;
  return { annReturn: logReturn / years, annVol };
}

/**
 * Annualised return and volatility at every skip × lookback, flattened
 * skip-major. The score is `annReturn / annVol` and the blend is the mean of
 * the two lookbacks' scores, both derived rather than stored — the page needs
 * them per combination and a division is cheaper to ship than a third array.
 *
 * @param {{date:string, close:number, volume:number}[]} bars Oldest first.
 */
export function score(bars) {
  const closes = bars.map((b) => b.close);
  const rt = [];
  const vl = [];
  for (const skip of SKIPS) {
    for (const lookback of LOOKBACKS) {
      const w = measure(closes, lookback, skip);
      if (!w) return null;
      rt.push(w.annReturn);
      vl.push(w.annVol);
    }
  }

  // Median dollar volume over the last quarter — a liquidity check that is not
  // thrown off by one earnings-day volume spike.
  const dollarVolumes = bars
    .slice(-63)
    .map((b) => b.close * b.volume)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  return {
    rt,
    vl,
    medianDollarVolume: dollarVolumes.length ? dollarVolumes[Math.floor(dollarVolumes.length / 2)] : 0,
    bars: bars.length,
    lastDate: bars[bars.length - 1].date,
  };
}

/** Blend score at one skip: the mean of the two lookbacks' scores. */
export function blendAt(rt, vl, skip) {
  let total = 0;
  for (let i = 0; i < LOOKBACKS.length; i++) {
    const k = at(skip, i);
    total += rt[k] / vl[k];
  }
  return total / LOOKBACKS.length;
}

/** Days of daily returns behind the correlation vector the page ships. */
export const VECTOR_WINDOW = 252;

/**
 * The most recent `VECTOR_WINDOW` daily log returns, centred, scaled to unit
 * length and quantised to int8. The page re-centres and re-normalises on
 * decode, so the dot product of two decoded vectors is the pair's correlation.
 *
 * The int8 scale is per-name rather than fixed: only the vector's shape
 * survives decoding, so the right scale is the largest one that clips nothing.
 * A fixed scale has to be set low enough for the worst crash day in the
 * universe and wastes resolution on everything else.
 */
export function returnVector(closes) {
  const n = closes.length;
  if (n < VECTOR_WINDOW + 1) return null;

  const tail = closes.slice(n - VECTOR_WINDOW - 1);
  const r = [];
  for (let i = 1; i < tail.length; i++) r.push(Math.log(tail[i] / tail[i - 1]));

  const mean = r.reduce((s, x) => s + x, 0) / r.length;
  const centred = r.map((x) => x - mean);
  const norm = Math.sqrt(centred.reduce((s, x) => s + x * x, 0));
  if (!(norm > 0)) return null;

  const unit = centred.map((x) => x / norm);
  const peak = unit.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

  return {
    b64: Buffer.from(unit.map((x) => Math.round((x * 127) / peak))).toString('base64'),
    exact: unit,
    // Annualised volatility over exactly this window, so the vector and the
    // scalar that turns it back into returns describe one stretch of tape.
    sd: (norm / Math.sqrt(VECTOR_WINDOW)) * Math.sqrt(TRADING_DAYS_PER_YEAR),
  };
}

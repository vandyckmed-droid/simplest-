# Momentum Desk

A cross-sectional momentum screener over large, liquid US stocks, grouped by
industry and ranked on volatility-adjusted 12-1 and 6-1 returns. Output is a
single self-contained HTML page designed for a phone.

```
npm run build        # refresh prices, rescore, regenerate dist/index.html
npm run data         # just src/build.js  -> data/screener.json
npm run render       # just src/render.js -> dist/index.html
```

`API_KEY` must hold a Financial Modeling Prep key. Everything targets FMP's
`/stable` endpoints; the v3 endpoints are retired for keys issued after
2025-08-31.

## The signal

For each name, two windows are measured on split- and dividend-adjusted daily
closes:

| Horizon | Window |
|---|---|
| **12-1** | 252 trading days ago → 21 trading days ago |
| **6-1** | 126 trading days ago → 21 trading days ago |

Both skip the most recent month. That gap is standard in momentum work: the
last few weeks of a stock's return tend to mean-revert, so including them
mixes a reversal signal into a momentum one.

Each window produces:

```
logReturn  = ln(P_end / P_start)
annReturn  = logReturn / (window length in years)
annVol     = stdev(daily log returns inside the window) * sqrt(252)
score      = annReturn / annVol
```

Numerator and denominator describe the identical stretch of tape, so the score
is a Sharpe-like, unitless number — comparable across the two horizons despite
their different lengths, and across names with very different volatility. The
**blend** that drives the default ranking is the plain average of the two
scores.

The detail drawer leads with `annReturn`, since an 11-month and a 5-month
window are not otherwise comparable — Dell's 12-1 and 6-1 raw returns are
+114% and +127%, which reads as "about the same" until you annualise them to
+125% and +304%. The raw window return still follows it, because that is what
the stock actually did.

## The rolling charts

Each drawer also carries two bar charts running the same arithmetic over a
trailing 63-session window that slides forward to the last close, **with no
skip**:

- annualised log return of the window
- that return divided by the window's own annualised volatility

Samples are weekly and stored oldest-first, so index `i` sits
`(count - 1 - i) * 5` sessions back from the last close — no per-stock date
array is needed to place anything on the axis. A dashed rule marks 21 sessions
back: everything to its right is the month the 12-1 and 6-1 scores deliberately
exclude, which is the part of the tape those two numbers cannot show.

Zero always sits on the axis, but only sits mid-plot when the series actually
crosses it, so a name that never turned negative uses the full height. Each
chart is scaled to its own extreme — read shape and sign, not height across
names.

## The universe

FMP's own industry taxonomy has ~130 entries, and only five of them contain 25
or more US companies above $3B in market cap — far too granular to fill
25-name buckets. `src/industry-groups.js` folds those industries into 22
GICS-style **industry groups**, which is coarse enough to rank within and much
finer than the 11-sector level. Each stock still carries its original FMP
industry, shown in the detail drawer.

Per group, selection runs:

1. US-listed common stock, actively trading, market cap ≥ $2B, non-ETF/fund.
2. Take the 34 largest by market cap as candidates.
3. Drop anything without a full 12-1 window of history, or with median daily
   dollar volume below $15M over the last 63 sessions.
4. Keep the top 25 by market cap, then rank those on the signal.

Size and liquidity are entry requirements only — they never enter the ranking.
Two groups (Pharmaceuticals, Consumer Finance & Payments) come up a few names
short because the underlying industries simply do not contain 25 qualifying
large caps; the rest hit 25.

## Layout

```
src/industry-groups.js   FMP industry -> industry group, plus chip abbreviations
src/fmp.js               /stable client: retries, bounded concurrency
src/momentum.js          the windowing, scoring, and rolling-series math
src/build.js             universe -> prices -> scores -> data/screener.json
src/template.html        the page; __DATA__ is the injection point
src/render.js            inlines the JSON, writes dist/index.html
```

`dist/index.html` is fully self-contained — the data is embedded, there are no
network requests, and it renders in light or dark according to the viewer's
theme.

## Caveats

Momentum is a statistical tendency measured on past prices. Nothing produced
here is a forecast or investment advice.

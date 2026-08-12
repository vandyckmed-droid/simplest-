# Momentum Desk

A cross-sectional momentum screener over large, liquid US stocks, grouped by
industry and ranked on volatility-adjusted 12-1 and 6-1 returns. Output is a
single self-contained HTML page designed for a phone: a Robinhood-style dark
ranked list with a group dropdown, a distribution strip, and a tap-to-build
equal-weight watchlist.

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

## The page

- Group dropdown (native select in a pill), `Blend / 12-1 / 6-1` sort, a
  direction toggle, and search over ticker and company.
- A summary strip per filter: median score, best name, share positive, count,
  and a distribution histogram.
- Each row: rank, ticker, the ranked score, and a micro-line with a
  colour-coded sector chip (TECH, HLTH, FIN, …) and the company name — no
  per-row bars, no drawer. Sign reads from the explicit +/− on every figure.
- **Watchlist**: tapping a row adds or removes it; selection persists in
  localStorage. A fixed bottom bar shows the count, the default equal weight
  per name (1/n), and the equal-weighted average blend; `WL` filters the list
  to the selection, `Clear` empties it. In the WL view the score histogram
  gives way to sector count bars — how many names each sector contributes,
  in that sector's hue.
- Single-theme Robinhood-style dark: true black, green #00c805 / red #ff5000.
  That pair is deutan-confusable, so sign always has a redundant channel
  (bar direction and an explicit +/− on every figure).

## The universe

FMP's own industry taxonomy has ~130 entries, and only five of them contain 25
or more US companies above $3B in market cap — far too granular to fill
25-name buckets. `src/industry-groups.js` folds those industries into 22
GICS-style **industry groups**, which is coarse enough to rank within and much
finer than the 11-sector level. Each stock still carries its original FMP
industry in data/screener.json, though the page itself no longer displays it.

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
src/momentum.js          the windowing and scoring math
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

---

# Ranks

A second, simpler page: every tradeable US name that clears a liquidity floor,
in one list, ranked on the blend. No industry buckets, no per-row charts.

```
npm run ranks        # refresh prices, rescore, regenerate dist/ranks.html
```

## The universe

`src/universe.js` turns FMP's screener output into things you could actually
place an order for. FMP's `country=US` filter is about domicile rather than
listing venue, so it returns London and Toronto lines for US companies
(`0YXG.L` is Broadcom); it also keeps preferred shares, baby bonds and SPAC
units, and lists every share class separately. The cleaner:

1. keeps NYSE / Nasdaq / AMEX only,
2. drops `-P*`, `-U*`, `-W*`, `-R*` suffixed lines (preferreds, units,
   warrants, rights) while keeping real share classes like `BRK-B`,
3. collapses each company to its most liquid line — this is what removes
   `GOOG` in favour of `GOOGL`, `BRK-A` in favour of `BRK-B`, and preferreds
   that share a parent's name without carrying a preferred suffix
   (`STRK` vs `MSTR`),
4. requires price ≥ $5 and ≥ $25M median daily dollar volume over 63 sessions,
   plus a full 12-1 window of history.

3,504 cleaned lines in, **1,511** out.

## Correlation

Each name ships 52 standardised weekly log returns, quantised to int8 and
base64'd — 72 characters per stock. The page re-centres and re-normalises on
decode, so the dot product of any two vectors *is* their correlation; no
matrix is precomputed and any pair can be evaluated on demand. `src/ranks-build.js`
checks the quantised vectors against exact correlations on every run and
reports the error (currently max |Δρ| ≈ 0.009, mean ≈ 0.002 — far below the
0.70 flag threshold).

A row is flagged when it correlates ≥0.60 with **any single name already
held**; the tag names the twin and the figure (`≈.84 JPM`). Holding a
diversified eight-name mega-cap basket flags 52 of 1,503.

**Sector concentration** is a red dot with a soft glow, not a label: the row's
sector is already ≥30% of the basket, with at least three names in it — below
that a percentage is too noisy to mean anything. A diversified eight-sector
basket trips neither mark.

## Marks

Every row carries a 12px line-drawing of its sector, keyed by sector *name* so
a rebuild that reorders the sector list cannot shuffle them. Each picks the
most literal object in that sector's world — a chip, a broadcast dot, a
cross, a bank, a droplet, a shopping bag, a shield, a factory, a cube, a
house, a bolt — so they read without a legend.

Two of them were redrawn after proofing at actual size: the chip started with
eight pins that turned to mush at 12px and now has four, and Industrials was
an eight-tooth gear that read as a *sun* and is now a factory silhouette.
Anything meant to be legible at 12px has to be checked at 12px.

## Metrics

`Blend / 12-1 / 6-1` switches score, return **and** volatility together — the
alternative leaves two of the three columns describing a different window than
the one you selected. Weights always size on blended volatility: changing the
displayed metric changes what you are reading, not how the basket is built.

## Filters

A third tab, currently holding one control: **market cap**, `All` or
`Top 500`. "Top 500 largest" is stored as a *rank*, not a dollar line — an
absolute threshold drifts as the market moves, a rank does not. The page ranks
every name by market cap once at load and the filter is `capRank <= 500`
(currently $16.7B and up).

Filters decide who is listed, never what anything scores: the momentum blend
is computed against the whole universe and does not move. The rank column is
positional, so it renumbers — under `Top 500` the list runs 1…500 with SNDK
at #1 on the same +2.98 it carries unfiltered. An active filter is tagged
beside the count in the header, so it is visible from the list rather than only
from its own tab, and it persists in localStorage.

## Weights

The basket weights inversely to volatility: `w_i ∝ 1/σ_i`, normalised to 100%.
Sector counts, average score, weighted volatility and the largest single
weight sit above the holdings.

## Layout

```
src/universe.js          screener output -> tradeable common stock
src/ranks-build.js       universe -> prices -> scores + corr vectors -> data/ranks.json
src/ranks-template.html  the page; __DATA__ is the injection point
src/ranks-render.js      inlines the JSON, writes dist/ranks.html
```

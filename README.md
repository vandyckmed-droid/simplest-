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
npm run test:hrp     # check the allocator against cases with known answers
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

3,504 cleaned lines in, **1,517** out.

## Correlation

Each name ships the most recent **252 daily log returns**, centred, scaled to
unit length and quantised to int8 — 336 characters per stock. The page
re-centres and re-normalises on decode, so the dot product of any two vectors
*is* their correlation; no matrix is precomputed and any pair can be evaluated
on demand. Multiply a vector by the name's `sd` and the return series comes
back, which is what the HRP covariance is built from — the ρ a row displays and
the ρ the allocator clusters on are the same number.

The int8 scale is per-name rather than fixed. Only the vector's shape survives
decoding, so the right scale is the largest one that clips nothing; a fixed
scale has to be set low enough for the worst crash day in the universe and
wastes resolution on everything else. `src/ranks-build.js` checks the quantised
vectors against exact correlations on every run: max |Δρ| ≈ 0.004, mean ≈ 0.001.

A row is flagged when it correlates ≥0.60 with **any single name already
held**; the tag names the twin and the figure (`≈.84 XOM`). Holding a
diversified eight-name mega-cap basket flags 27 of 1,517.

That is fewer than the 52 the old weekly vectors flagged, because daily
correlations run lower than weekly ones — aggregating to weeks averages out
idiosyncratic noise and lifts every pair. Against the daily distribution 0.60 is
well into the tail: the universe's median pairwise ρ is 0.11 and the 95th
percentile is 0.39. Dropping the threshold to 0.55 would flag 47 and 0.50 would
flag 71, if the mark is wanted more often.

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

`Blend / 12-1 / 6-1`, in Settings, switches score, return **and** volatility
together — the alternative leaves two of the three columns describing a
different window than the one you selected. The active metric names the score
column, so it stays visible from the list. Weights always size on blended volatility: changing the
displayed metric changes what you are reading, not how the basket is built.

## Settings

A third tab holding both controls that change what the list shows: the
**metric** switch and a **market cap** cutoff. Neither lives in the Ranks
header — that keeps the list itself to a search box, a sector dropdown and the
column headers.

"Top 500 largest" is stored as a *rank*, not a dollar line — an absolute
threshold drifts as the market moves, a rank does not. The page ranks every
name by market cap once at load and the filter is `capRank <= 500` (currently
$16.7B and up).

Filters decide who is listed, never what anything scores: the momentum blend
is computed against the whole universe and does not move. The rank column is
positional, so it renumbers — under `Top 500` the list runs 1…500 with SNDK
at #1 on the same +2.98 it carries unfiltered. An active filter is tagged
beside the count in the header, so it is visible from the list rather than only
from its own tab, and it persists in localStorage.

## Weights

Three schemes, switched in Settings; the basket re-weights immediately.

| | |
|---|---|
| **Equal** | `1/n` |
| **Inv vol** | `w ∝ 1/σ`, on the blended volatility the Vol column shows |
| **HRP** | hierarchical risk parity — below |

Equal and inverse-vol size off a number already on screen, so both stay
checkable with a pencil. HRP cannot be: it needs the whole covariance matrix.

Sector counts, average score, weighted volatility and the largest single weight
sit above the holdings.

### HRP

```
252 daily returns -> sample covariance -> Ledoit-Wolf shrinkage
  -> correlation distance -> average-linkage tree -> quasi-diagonalisation
  -> recursive bisection -> 10% cap -> normalise
```

The point is that a crowded cluster gets sized as one bet. Inverse-vol hands
eight semis eight positions' worth of the book; HRP makes them compete with each
other first, and only their total competes with the rest. On a basket of eight
tech names plus four utilities the tech share falls from 62% to 52%; on five
energy plus five tech, energy falls from 62% to 51%. On a basket with no cluster
structure it lands within a point of inverse-vol, which is the correct answer
there.

Shrinkage is Ledoit & Wolf's constant-correlation estimator, with the intensity
derived analytically rather than tuned: 252 observations across N names give a
sample covariance whose smallest eigenvalues are badly biased, and that is
exactly what an optimiser leans on. HRP never inverts the matrix, so a
near-singular sample degrades the answer instead of detonating it.

Two steps depart from López de Prado's published algorithm, both settled by
measurement against the real universe rather than by preference — `npm run
test:hrp` pins the behaviour:

- **Splits halve by position, not at the dendrogram's merge points.** Splitting
  where the tree splits sounds strictly better and is much worse. Inside a group
  with no real structure the tree is decided by noise, and an unbalanced tree
  makes weights decay geometrically — six statistically identical names came out
  between 1.9% and 26.8%, and three semis with the same 60% volatility landed on
  0.1%, 0.2% and 0.3%. Scoring cuts by how well they separate the two sides
  fixes the synthetic case and fails the real one: on live correlations it
  latches onto structure that is not there, reaching a 293:1 spread and pushing
  a single-sector basket from 28.9% to 37% in its top name. Tightening the test
  far enough to be safe just turns it back into positional halving.
- **Branches split on inverse volatility, where the paper uses inverse
  variance.** Inverse variance is a minimum-variance step, not a risk-parity
  one; equalising two branches' risk contribution calls for `w ∝ 1/σ`. Measured,
  the variance version piles into whatever is quietest — an eight-name mega-cap
  basket came out 44.5% in one name at a 31:1 spread, against 28.9% and 5.5:1 —
  while diversifying no better.

The trade the first choice makes: positional halving only lands on a cluster
boundary when the boundary is near a midpoint, so a small tight cluster inside a
larger basket is de-concentrated less than a balanced one. That is the price of
not inventing structure, and it is the cheaper of the two errors.

The **10% cap** applies above ten names. Ten names under a 10% cap can only be
equal-weighted and nine cannot meet it at all, so below eleven the cap is left
off rather than quietly flattening the basket. Overflow is pushed onto the names
still under the cap in proportion to what they already hold, repeating, since
absorbing overflow can lift a name over the line itself.

## Display

Weights read as **percent** or as **cash** — the dollars each holding needs in a
hypothetical $10,000 book, which is what the `$10K` column header names. Both
are apportioned by largest remainder so the column sums to exactly 100% or
exactly $10,000; rounding each row on its own lands near the total but not on
it, and a column of weights is a thing readers add up.

## Layout

```
src/universe.js          screener output -> tradeable common stock
src/ranks-build.js       universe -> prices -> scores + return vectors -> data/ranks.json
src/hrp.js               shrinkage, clustering, bisection, cap — no DOM, no imports
src/hrp-test.js          npm run test:hrp
src/ranks-template.html  the page; __DATA__ and __HRP__ are the injection points
src/ranks-render.js      inlines the JSON and src/hrp.js, writes dist/ranks.html
```

`src/hrp.js` is one file in two roles: a Node module the test suite can exercise
against cases with known answers, and the page's allocator, inlined verbatim
with only its export line stripped. The renderer fails the build if either
injection point survives or an export leaks through.

Carrying 252 daily returns per name instead of 52 weekly ones takes
`dist/ranks.html` from 359 KB to 810 KB. That is the whole cost of HRP: the
allocator needs a covariance matrix over whatever the reader happens to pick, so
every name has to arrive with its return series.

---

# ETF universe

`src/etf-universe.js` holds a thematic ETF list — **16 themes, 93 unique funds,
120 listings**. Settings › Universe switches the Ranks list between single
stocks and these funds; `npm run ranks` builds both.

It is stored as ordered groups rather than a flat ticker list because the
grouping carries meaning: 24 funds sit under more than one theme (GRID is grid
infrastructure, water infrastructure *and* electrification; COPX is a copper
miner and a battery-materials play), and the lens you arrive through changes
what the fund is to you. `ETF_UNIVERSE` derives one entry per ticker, keeping
every theme it belongs to plus any alternate label.

## How the two universes differ

The maths is identical — a fund has adjusted closes like anything else, so
`src/momentum.js` scores it unchanged and `src/etf-build.js` reuses it whole.
Four things differ:

- **No screener step.** The curated list *is* the universe, so `src/universe.js`
  (which exists to throw funds away) is not involved.
- **No liquidity floor.** Median daily dollar volume runs from under $0.1M
  (NERD) to $6.5B (SMH); the stock side's $25M would delete 39 of the 89
  scoreable funds, including most of the thematic ones the list exists for. The
  list is kept whole instead.
- **No market cap.** A fund has assets, not a capitalisation, so the Top 500
  cutoff has nothing to rank and hides itself in ETF mode.
- **Themes, not sectors.** The group dropdown reads "All themes" and carries the
  16 groups. Ten map onto an existing sector mark; six needed drawing — a grid
  for broad sectors, a sprout, waves, a rocket, linked nodes, and mountains.

Names come from the theme list rather than the fund's legal name: SMH is
"Semiconductors", not "VanEck Semiconductor ETF".

Baskets are **per universe**, in separate localStorage keys — switching to funds
does not mix ETFs into a stock basket or empty it. The correlation and
concentration flags work identically within each. Among funds they are blunt by
nature: holding XLK, SMH and IGV flags 28 of 86, with AIQ≈XLK at 0.95,
QTUM≈SMH at 0.92 and SKYY≈IGV at 0.91 — thematic tech funds overlap heavily,
and the flag says so.

HRP has correspondingly less to work with among funds than among single stocks:
where a stock basket's clusters are things the reader assembled by accident, a
thematic fund *is* a cluster already, and two of them either overlap or do not.

## Health of the list

```
npm run etf:check
```

Re-run before building on it. Thematic ETFs close and get renamed far more often
than stocks do, and a dead fund still returns a *quote* — it is the history that
stops moving, which is what the check actually looks at.

As of 2026-08-12, 89 of 93 score cleanly. The four that do not are kept in the
list as given rather than quietly swapped, and recorded in `ETF_ISSUES`:

| Ticker | Problem |
|---|---|
| `VPN` | Quotes but no adjusted history. Global X renamed it "Data Center REITs & Digital Infrastructure"; ~25k shares/day. **`DTCR`** covers the same theme at ~674k shares/day. |
| `PBS` | Quotes but no adjusted history. Invesco Dynamic Media, ~2k shares/day — effectively untradeable. |
| `BJK` | Stopped trading; last bar 2026-05-18. |
| `EATZ` | Stopped trading; last bar 2026-05-07. |

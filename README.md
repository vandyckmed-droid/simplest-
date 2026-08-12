# Ranks

Every tradeable US stock — 1,517 after cleaning — plus 89 thematic ETFs, in one
list, ranked on volatility-adjusted 12-1 and 6-1 momentum. Tap to build a
basket; it sizes itself equally or by inverse volatility, in percent or in
cash, or fill itself. Output is a single self-contained HTML page built for a
phone — 809 KB, no network requests.

```
npm run build        # refresh prices, rescore, regenerate dist/ranks.html
npm run data         # stocks only    -> data/ranks.json
npm run etfs         # funds only     -> data/etfs.json
npm run render       # inline + write -> dist/ranks.html
npm run etf:check    # is every fund in the list still trading?
```

`API_KEY` must hold a Financial Modeling Prep key. Everything targets FMP's
`/stable` endpoints; the v3 endpoints are retired for keys issued after
2025-08-31.

## The signal

A window has two edges, and both are settings on the page:

| Edge | Setting | Values |
|---|---|---|
| where it **opens** | Window | 252 trading days back (12 mo), 126 (6 mo), or the blend of both |
| where it **closes** | Skip | 0, 10 or 21 trading days short of today — 0%, 50%, 100% of a month |

The conventional definition is the 100% skip: that is the "-1" in 12-1 and 6-1,
and it is standard in momentum work because the last few weeks of a stock's
return tend to mean-revert, so including them mixes a reversal signal into a
momentum one.

It is also worth being able to switch off, which is why it is a toggle rather
than a constant. A name can rank badly on a window that closed a month ago and
have turned since — GDX sits 81st of 89 funds on the conventional definition
while being up 23% over the skipped month. That is a fact about the measurement,
not about the fund, and the page should not hide it.

Every name is measured at all six combinations. Each produces:

```
logReturn  = ln(P_end / P_start)
annReturn  = logReturn / (window length in years)
annVol     = stdev(daily log returns inside the window) * sqrt(252)
score      = annReturn / annVol
```

Numerator and denominator describe the identical stretch of tape, so the score
is a Sharpe-like, unitless number — comparable across horizons despite their
different lengths, and across names with very different volatility. The
**blend** is the plain average of the 12-month and 6-month scores at whichever
skip is selected.

Only `annReturn` and `annVol` ship, six of each. Score is a division and blend
is a mean, so a third array would be arithmetic the page can do itself. Moving
either edge re-ranks the list positionally — the stored rank is the conventional
definition, and the displayed one is always the position in the list you are
looking at.

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

## Names

FMP's company names carry share-class and legal-form boilerplate that eats the
one line of width a phone gives them, so it is stripped and a couple of dozen
long words are abbreviated. Two cases need care: stripping "Company" off "Wells
Fargo & Company" leaves a dangling ampersand, and 65 names tidy down to their
own ticker — Roku Inc. to "Roku", CSX Corporation to "CSX" — where a grey line
repeating the ticker above it reads as a bug. Backing the `Holdings`/`Group`
strip off rescues the ones with a real word in them (`PACS Group`, `HCI Group`);
the remaining 55 lose the line and show ticker alone.

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

## Window and Skip

Two settings, one per edge. **Window** switches score, return **and** volatility
together — the alternative leaves two of the three columns describing a
different stretch than the one you selected — and names the score column, so it
stays visible from the list. **Skip** tags itself beside the count whenever it is
not the conventional 100%, the same way an active market-cap cutoff does.

Neither is redundant. Only **12 of the top 25** names are shared between Blend
and 12 mo (28 of 50, 57 of 100), and the two lookbacks rank-correlate 0.673.

## Settings

A third tab, holding everything that changes what the list shows or how the
basket is built: **universe**, **weights**, **display**, **window**, **skip** and
a **market cap** cutoff. None of it lives in the Ranks header — that keeps the
list itself to a search box, a sector dropdown and the column headers.

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

Two schemes, switched in Settings; the basket re-weights immediately.

| | |
|---|---|
| **Equal** | `1/n` |
| **Inv vol** | `w ∝ 1/σ`, on the blended volatility the Vol column shows |

Both size off numbers already on the screen, so either can be checked against
the list with a pencil — which is the whole brief for this page.

Above the holdings sit the average score, the weighted volatility, the largest
single weight, and one row of sector marks with counts. That row used to be one
row *per* sector — eleven of them on a fourteen-name basket, which put the first
holding below the fold. The marks are the ones already on every row, so the
tally needs no legend, and each pair binds tight and separates wide: at an even
spacing, Healthcare's cross beside its count reads as "+1" — one more — rather
than one healthcare name.

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
src/ranks-template.html  the page; __DATA__ is the injection point
src/etf-holdings.js      hand-kept top holdings per fund, resolved at render time
src/etf-universe.js      the thematic fund list, as ordered groups
src/momentum.js          the windowing and scoring math, shared by both builds
src/ranks-render.js      inlines the JSON, writes dist/ranks.html
```

`dist/ranks.html` is fully self-contained — the data is embedded, there are no
network requests, and it renders in light or dark according to the viewer's
theme.

It carries 252 daily log returns per name, quantised to int8 and base64'd, so
the basket filler can compute correlations over whatever the reader is looking
at. That is 570 KB of the page — the whole cost of selecting on correlation
rather than on rank alone.

What the page does carry per name is six annualised returns and six
volatilities — every skip against every lookback — because the reader moves both
edges of the window at runtime and neither can be derived from the other.

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
does not mix ETFs into a stock basket or empty it.

## Look-through

Funds with a holdings list carry a chevron at the end of their name line.
Tapping it opens the fund's top holdings resolved against the stock universe — each name's rank
and score, following the metric switch, so what you read there is the number the
stock list would show. The row itself still selects into the basket; only the
chevron looks through. (That is why a row is a `div` with `role="button"` rather
than a `<button>`: a button inside a button is not valid HTML, and the keyboard
behaviour is restored by hand.)

The view leads with the gap it exists to show:

```
XHS blend        +2.97
Holdings blend   +1.08
Holdings vol     64% vs 17%
Listed weight    22.4% of fund
```

**A fund's score is mostly its denominator.** XHS's top ten weight out to a 60%
return against the fund's 52% — close. Their weighted *volatility* is 64%
against the fund's 17%. Diversification collapses the volatility of a 70-name
book to a quarter of its average constituent's, and since the score is a return
divided by exactly that, the fund scores +2.97 where its holdings score +1.08.
XHS is not top of the ETF list because it holds the strongest trends — it holds
names ranked 13th and 1,254th side by side — but because the blend is smooth. A
stock's +2.97 and a fund's +2.97 are the same number describing different
things, which is worth knowing when the two universes are one tap apart.

Names that miss the stock universe are kept and marked rather than dropped, and
the mark says only what is known. Three misses are liquidity, with the figure
shown rather than a guess: USPH at $14M a day, CON at $24.5M and AMLX at $24.7M
against a $25M floor — two of them short by less than a rounding error, which is
worth seeing rather than reading as "not tradeable". Six are something else
entirely: CRAK's book is largely foreign lines (RIGD is a London GDR, 5020 is
Tokyo, 096770 is Seoul) that were never candidates for a US-listed universe, and
calling those thin would be wrong. A hole in the mapping is information about
the fund's book too — refining is a global business and CRAK is built like one,
so its top ten covers 57.7% of the fund but only 26.9% of it lands in a
US-listed universe.

Two limits are structural, and the page states both rather than implying a
completeness it does not have. FMP's ETF-holdings endpoint answers 402
*Restricted Endpoint* on this key, so `src/etf-holdings.js` is transcribed by
hand and holds **top tens, not books** — XHS's ten rows are 22.4% of the fund
and the other ~78% is unmapped, so every figure above is a sample of the largest
positions. Coverage varies wildly with how concentrated the fund is: IHF's top
ten is 71.2% of it (UNH alone is 20.9%) and REZ's is 69.7% (WELL alone is 24%),
where XPH's is 25.5%. Six funds are mapped so far — XHS, IHF, CRAK, XPH, REZ,
CIBR — and adding more is a matter of appending `[ticker, weight]` rows; the
renderer warns if a listed symbol is not a scored fund.

The size of the gap is itself the interesting reading, and it varies more than
the "funds score higher" rule suggests:

| | fund ret | holdings | fund vol | holdings | fund blend | holdings |
|---|---|---|---|---|---|---|
| XHS | 52% | 60% | 17% | 63% | **+2.97** | +1.08 |
| IHF | 48% | 57% | 20% | 34% | **+2.51** | +1.63 |
| CIBR | 50% | 77% | 29% | 51% | **+1.66** | +1.63 |
| REZ | 24% | 27% | 16% | 23% | **+1.43** | +1.19 |

CIBR is the case where it nearly vanishes. Its volatility still collapses — 51%
across the top ten down to 29% for the fund — but its return collapses with it,
50% against the top ten's 77%, because those ten are only 58% of the book and
the other 42% did far worse. The two effects cancel and the fund ends up scoring
what its largest holdings score. REZ is the opposite reason for a small gap: ten
REITs that already move together barely diversify, so there is little
denominator to gain. And weights are current while momentum is historical: a name bought
last month is credited with a year of returns the fund did not hold through.

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

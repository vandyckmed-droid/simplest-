# Stock App

You choose the stocks. The system calculates everything else.

The only actions the product ever offers are **look, sort, filter, inspect,
select, deselect**. Portfolio weights are never entered by hand — they are
derived. Every phase is built against that rule.

## Status — Phase 11: A hundred names

| Built | Not built yet |
| --- | --- |
| iPhone-first layout with safe-area handling | A universe beyond 100 names |
| Ranks, ordered by Momentum Blend | Covariance, correlation, clustering, HRP |
| Select / deselect, persisted on the device | Weighting beyond equal |
| Ticker detail: price, real graph, 1M–2Y windows | User-facing sort and filter controls |
| 12–1 and 6–1 return, risk-adjusted momentum, and rank | Intraday prices |
| Momentum Blend, the primary ranking value | |
| Swipe left/right through the ranked list | |
| Portfolio: your selections, equal-weighted to 100% | |
| Real adjusted end-of-day prices, names, and logos | |
| The 100 most liquid US-listed companies | |
| ADRs, competing on the same liquidity rule | |
| Light and dark mode | |

## The momentum signals

`src/momentum.ts` holds the maths as pure functions over an ascending series
of adjusted closes. Trading day −k is `closes[length - 1 - k]`. Both windows
end at day −21, skipping the most recent month so the last few weeks'
reversal does not contaminate the measurement:

| Window | Span |
| --- | --- |
| 12–1 | day −252 → day −21 |
| 6–1 | day −126 → day −21 |

Both go through the same `momentumWindow` function, so they cannot drift
apart in how they measure.

| Figure | How |
| --- | --- |
| Return | `P(−21) / P(−lookback) − 1` |
| Volatility | sample standard deviation of daily log returns in that window, × √252 |
| Risk-Adjusted Momentum | return ÷ volatility |
| Rank | `100 × (names with a lower risk-adjusted value) / (count − 1)` |
| **Momentum Blend** | `0.5 × 12–1 rank + 0.5 × 6–1 rank` |

The blend is the primary ranking value: it orders the Ranks screen and sets
each row's rank number. A stock missing either window has no blend rather
than a half-informed one, and sorts to the bottom; ties fall back to the
symbol so the order is stable.

Ties share the lower percentile, so the weakest name sits at 0 and the
strongest at 100. It is shown out of 100 — "89 / 100" — rather than as an
ordinal, which would read like a position in the list rather than a score. A price line that never moves has no risk to divide by, so
its ratio is null rather than astronomical — floating-point noise leaves
around 1e-16 of "volatility" on a flat series, which is why the guard is a
small epsilon and not a test against zero.

Everything is derived once from the stored closes, so the same dataset always
gives the same numbers — no rank is stored in `market.json`, because ranking
is a calculation rather than data. `npm test` checks each step against
examples worked out by hand, and re-derives every stock's returns straight
from the raw prices.

## The universe

A hundred names, chosen by a rule rather than by hand, so the list can be
rebuilt from scratch and come back the same. `tools/universe.mjs` owns it:

1. Ask the provider's screener for actively traded stocks on NYSE, Nasdaq or
   NYSE American, above $2bn of market cap and $5 a share, from any country.
   ETFs and funds are excluded by the screener.
2. Drop anything whose symbol is not a plain ticker or one of the A/B classes
   that are still common stock. Preferreds (`BAC-PB`), warrants, rights and
   units all carry a suffix the pattern will not match.
3. Take the 300 most active of those as a pool — this only bounds how much
   history is downloaded. It has to be comfortably wider than the universe,
   since the pool is ordered on a single day's dollar volume while the
   selection is made on a quarter's median.
4. Settle each candidate's **security type** from its profile, and keep only
   domestic common stock and ADRs. The rules are below.
5. Measure each survivor properly from our own adjusted bars: the **median
   daily dollar volume over the last 63 sessions**. A median rather than a
   mean, so one frantic day cannot buy a name its way in.
6. Drop anything without the 253 sessions the 12–1 signal needs.
7. Keep one listing per company — the most liquid one.
8. Keep the top 100. Ties break on symbol, so the same data always gives the
   same list in the same order.

At the last build 262 companies survived eligibility and the cut fell at
$987m a day — five of the hundred are ADRs. Two names are younger than the 2Y
graph (SanDisk, 375 sessions; CoreWeave, 345); both clear the 12–1 window
comfortably, and their longest graph span simply starts at their first
session.

### What counts as eligible

| Security | Eligible where |
| --- | --- |
| US common stock | NYSE, Nasdaq, NYSE American |
| ADR | NYSE, Nasdaq |
| Everything else | nowhere |

An ADR is admitted on the provider's own `isAdr` flag rather than on being
foreign, because those are not the same question. A foreign company whose
ordinary shares list directly — Shopify, Linde, Accenture, MercadoLibre — is
neither a domestic common stock nor a depositary receipt, so it stays out;
the security type this phase admitted is the ADR, and nothing wider. OTC
never arises: the screener is asked for three exchanges and nothing else, so
an over-the-counter receipt is never a candidate, and NYSE American is
allowed for domestic common stock but not for ADRs.

ADRs are otherwise indistinguishable. They clear the same liquidity median
and the same history floor, they are scored by the same functions against the
same cross-section, and no row, figure or weight is adjusted because a holding
is a receipt. The build reports which of the fifty are ADRs, and every
exclusion it made, so the rule can be read off the output rather than trusted.

### One listing per company

Two lines into the same business would be two positions in a portfolio that
thinks it holds two things. Listings are grouped by the registrant's **CIK**,
which share classes have in common — Alphabet's A and C shares answer to one
key — and the most liquid of each group is kept. Where the provider has no
CIK, the company name with its legal form stripped decides instead; that is
the weaker test, so every merge it makes is named in the build notes. This is
what keeps `GOOG` out while `GOOGL` stays in.

## Market data

`src/data/market.json` is generated by `npm run data` and committed. It holds,
for each of the hundred, the company name, exchange, domicile, whether it is
an ADR, the latest adjusted close, the day change, market cap, median dollar
volume, and 540 sessions of adjusted daily closes.

Every series ends on the same session. The provider can be a day ahead on
some symbols — a partly-filled current day, or simply a series fetched later
than the rest — and a cross-sectional rank only means something if every name
is measured to the same date, so bars past the date most of the field last
traded are trimmed off and the trim is reported.

```sh
npm run data              # refresh from the API (needs API_KEY)
npm run data -- --refresh # ignore the cache and re-download
```

**Credentials.** `API_KEY` is read from the environment by `tools/` at build
time only. It never reaches the browser, the bundle, the dataset, or the
repository — the app ships a static JSON file and makes no network request of
its own at runtime.

**Caching.** Raw provider responses are written to `data-cache/` (gitignored)
and reused for 12 hours, so re-running the build does not re-download history
that has not changed. Logos are cached for 30 days. `--refresh` bypasses both.

**Determinism.** Bars are validated, de-duplicated, sorted oldest-first, and
rounded to four decimals before being written, so the same inputs always
produce the same file and later phases can calculate against something stable.

**Failure handling.** Requests retry four times with backoff, and rate limits
are retried rather than thrown. A symbol that cannot be built is skipped with
a reported reason instead of failing the whole dataset, and the build reports
every data-quality problem it found.

The build used to cross-check each day change against the provider's live
quote. That check is gone, because it could not be made to mean anything: the
quote describes whichever session is trading now, while this dataset ends at
the last session the whole field completed, so it fired on perfectly good
data — at a hundred names, on a third of the universe. Gating on the quoted
price matching our last close does not rescue it either, since a stock
trading near yesterday's close passes while still being quoted a day later.
What it was guarding against, a wrongly adjusted series, is not detectable
this way: a missed split looks like a large single-day move, and this
universe holds genuine ones up to +59%. The figures are checked where it
works instead — `npm test` re-derives every stock's momentum from the stored
closes, and the browser suite asserts each day change on screen against price
÷ previous close.

### Selection

Tapping the disc on the right selects a stock; tapping it again deselects.
The chosen symbols live in `localStorage` under `stock-app.selection` and
survive a reload. Selection changes hue rather than weight — a filled green
puck would read louder than the ranking it sits beside.

`selectionStore.ts` is a module-level store read through `useSyncExternalStore`,
not per-component state, so Ranks, ticker detail, and Portfolio can never
disagree about what is selected.

### Portfolio

Portfolio is not a screen you fill in — it is a view of the selection. It
shows only selected stocks, in ranked order, with the weight the system gave
each one. The header carries the two facts that matter: the total weight and
the number of holdings.

Phase 4 weights every holding equally. Weights are distributed in tenths of
a percent by largest remainder, so what is on screen adds to exactly 100.0%
instead of 99.9% — three holdings read 33.4 / 33.3 / 33.3 rather than three
thirds that quietly lose a tenth. `weights.ts` owns this and nothing else
writes a weight.

There is no way to edit a weight, by design. The + / ✓ control appears on
Portfolio rows too, so a holding can be dropped from here; because every
screen reads the one selection store, removing a stock anywhere re-weights
the rest immediately.

### Ticker detail

Tapping a row anywhere except the select control opens that stock. Detail is
an overlay above the tab bar rather than a third tab, so Ranks stays mounted
underneath and back returns to exactly the scroll position you left.

The graph is the screen: full-bleed, 232px tall, a single line with no axes,
grid, or fill. It is green rising and red falling, and the window buttons are
marked in ink rather than the accent so a second colour never fights it. The
window defaults to 1Y and is kept while swiping between stocks, so spans
compare like for like.

Swipe left or right to move through the ranked list, or use the arrow keys;
Escape closes.

Every stock has its own pane, side by side in a single track, and only the
track's transform moves. That matters for more than tidiness: moving a node in
the DOM restarts its CSS animations, so a pager that recycled a window of
pages replayed the chart's draw on every swipe and flashed as the nodes were
re-inserted. Nothing moves, so nothing restarts.

The panes never move, but their contents wait: only the visible page and the
one either side are filled in. Building all fifty at once cost 1.8s to open
detail on a throttled phone; one page either side is enough that whatever you
swipe to was already built before you arrived, so landing on it still never
replays the draw. This is what let the universe double without the screen
noticing: at a hundred names, opening detail still takes 660ms and three
pages are built, not a hundred.

Committing a page is one continuous transition — the target changes from "this
page plus the drag" to "the next page", and CSS carries it the rest of the
way. There is no snap back to the middle. A page turns if the drag passes a
quarter of the width, or on a flick that is both fast and past an eighth of
it; anything shorter springs back. Dragging past either end stretches instead
of moving.

The gesture locks to whichever axis it moves along first, and the viewport
carries `touch-action: pan-y`, so vertical scrolling stays with the browser
and never turns a page.

The price line draws itself from left to right when a stock opens and again
whenever the window changes, over 620ms. It is a clip that uncovers the line
rather than a dash-offset draw: `non-scaling-stroke` measures dashes after the
viewBox has been stretched, so a dash pattern repeats instead of running once.
Swiping does not redraw: the pages are never rebuilt, so their animations
never restart.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
```

Open it on a phone, or in a desktop browser's device toolbar at iPhone width.
Both themes follow the system setting; the icon in the top right overrides it
and the choice is remembered.

```sh
npm run build    # typecheck + production build
npm run preview  # serve the production build
```

## Visual language

Set once, in `src/styles/tokens.css`, and reused everywhere:

- **Surfaces** — pure white and pure black, no gradients or cards.
- **Type** — system font, 34px screen titles, 17px rows, tight tracking, and
  tabular figures so every number column aligns.
- **Space** — a 4px rhythm on a 20px gutter, kept generous.
- **Lines** — hairline separators inset to the gutter. No boxes, no shadows.
- **Accent** — one bright green, spent only on gains; one orange-red on losses.
  Nothing else is coloured.

To change the look, change the tokens. Components read them and never hardcode
a colour or size.

## Layout

The app is a fixed iPhone-width frame with one scrolling panel inside it, so
the translucent tab bar stays put and content passes cleanly underneath.

```
src/
  App.tsx              frame, active tab, scroll reset
  useTheme.ts          system scheme, manual override, persistence
  format.ts            money / percent / weight formatting
  types.ts             Stock, Holding, TabId
  selectionStore.ts    chosen symbols: one store, every screen
  weights.ts           equal weighting, summing to exactly 100%
  useCarousel.ts       the finger-tracking pager behind ticker detail
  momentum.ts          the 12–1 and 6–1 signals, as pure functions
  data/market.ts       the app's only view of market data
  data/market.json     generated dataset (real adjusted closes)
  assets/logos/        real company marks, bundled at build time
  screens/
    RanksScreen.tsx    the ranked list
    DetailScreen.tsx   ticker detail overlay
    PortfolioScreen.tsx
  components/
    Screen.tsx         title block, safe areas, section labels
    Row.tsx            the one list row both screens use
    LogoMark.tsx       logo placeholder
    SelectControl.tsx  the + / check disc
    PriceGraph.tsx     the price line
    WindowPicker.tsx   1M / 3M / 6M / 1Y / 2Y
    TabBar.tsx         bottom navigation
    Icons.tsx          stroke icons
  styles/
    tokens.css         the design language
    global.css         reset and base type

tools/                 build-time only; never shipped to the browser
  test-momentum.ts     hand-worked tests for the momentum maths
  fmp.mjs              provider client, reads API_KEY from the environment
  universe.mjs         the eligibility and liquidity rules that pick the fifty
  test-universe.mjs    hand-worked tests for those rules
  cache.mjs            on-disk cache of raw responses
  build-market-data.mjs  fetch -> validate -> src/data/market.json
```

`Row` is deliberately shared: Ranks and Portfolio must keep an identical
rhythm as later phases add to them.

## Stack

React 18, TypeScript (strict), Vite, CSS Modules. No UI framework, no state
library, no runtime dependencies beyond React.

## Verified

Checked in Chromium at iPhone 14 Pro and 320px widths, in light and dark:

- Screens render; the tab bar switches and resets scroll
- The last row and the Portfolio footnote clear the tab bar
- Nothing overflows horizontally; the subtitle holds one line down to 320px
- Every row is at least 44px tall and each select control has a 44x44 hit area
- Selecting, deselecting, and persistence across reload and tab switches
- Tapping the row body opens detail; tapping the select control does not
- Detail shows every required field, defaults to 1Y, and redraws per window
- Swiping moves through the ranked list, keeps the window, and stops at the ends
- Selection stays in step across Ranks, detail, and Portfolio
- Back restores the Ranks scroll position exactly
- Portfolio shows only selected stocks, in ranked order, with no editable field
- Every holding count from 1 to 100 displays weights totalling exactly 100.0%
- Adding or removing in Ranks, detail, or Portfolio re-weights the rest at once
- The empty state appears with nothing selected
- Every displayed price and day change matches `market.json` exactly
- Each graph window draws a distinct real series over the right date range
- The page makes no external network request at runtime
- No credential or provider hostname appears anywhere in the built output
- Every momentum figure on screen matches a recomputation from the raw closes
- The skipped month cannot change either signal, checked by tampering with it
- Ranks is ordered by the blend, and each row's rank matches its position
- The track follows the finger, with no easing until the gesture ends
- A vertical or mostly-vertical drag never changes stock, nor does a short one
- A flick turns the page; the same distance taken slowly does not
- The line draws on open and on a window change, but not while swiping
- Swiping does not re-create any page, checked with a marker on each node
- Selecting from ticker detail does not rebuild the pager either
- The theme toggle round-trips and survives a reload
- All hundred are common stock or ADRs, each on an exchange its type allows
- No two holdings are the same company, checked on CIK
- Every stock's history ends on the same session
- ADRs carry no badge, no adjusted figure and no different weight
- Every one has a pane, a graph in each window, and a full set of stat rows
- Ranks, detail and Portfolio agree across all hundred
- No console errors, and `npm run build` passes strict typecheck

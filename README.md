# Momentum Desk

A phone-first app for ranking stocks on risk-adjusted momentum, drilling from the
broad market down into sectors, industries and individual names, and
understanding what a basket of them is actually likely to do.

Built as three separate layers so any one of them can be replaced without
touching the others:

```
config/          what the universe is        (edit this to widen coverage)
pipeline/        how the data is fetched     (Node, runs offline, writes JSON)
app/src/analytics/  the maths                (pure functions, no UI, no network)
app/src/screens/    the interface            (Expo / React Native)
data/            reusable artifacts          (feeds other views and other apps)
```

The analytics layer is the single source of truth for every number. The pipeline
imports it to build the dataset, and the app imports the same files to render it,
so a rank shown on screen cannot drift away from the maths that produced it.

---

## Running it on a phone

The app ships with its dataset bundled, so it works offline and makes no API
calls while you browse.

### Expo Go (recommended, works every time)

```bash
git clone <this repo>
cd simplest-/app
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS).

### Snack

Snack's "Import git repository" button expects the Expo project at the
repository root. This repo keeps the app in `app/` on purpose — the full price
history in `data/` is far too large for Snack to load. So either:

- open [snack.expo.dev](https://snack.expo.dev), then drag the **contents of the
  `app/` folder** into the file tree, or
- point Snack at a repository whose root is a copy of `app/`.

`app/` is fully self-contained: `App.js`, `package.json`, `app.json`, `src/` and
`data/` (about 1.5 MB) is everything the app needs.

---

## What the app shows

**Overview** — where the market is (SPY, long bonds, oil, gold, Bitcoin), the
leading sectors, the leading stocks, and a plain-language read on your own basket.

**Rankings** — all 275 securities. Switch between the 12-1, 6-1 and blended
measures, rank globally or within sector, filter by sector, sort seven ways, and
hide names you never want to see. Long-press a row to hide it.

**Sectors** — eleven equal-weight sector series and every industry large enough
to be ranked, charted and scored with the same framework as individual stocks.
Every label drills one level narrower.

**Ticker** — price or relative-performance chart with touch scrubbing, comparison
against SPY / its sector / its industry, and each of the three scores broken open
to show the return, the volatility, the window length and the observation count
that produced it.

**Basket** — select stocks, set weights, and get expected movement in money terms
rather than in sigmas, plus a diversification read, the holdings that add the
least new information, and what removing each one would do to the risk.

**Search** — any security in the universe by ticker, company name, sector or
industry.

**Methodology** — every calculation in the app, in the order it happens.

Dark and light themes follow the system setting, or can be pinned in Settings.
Selections, weights, hidden names and filters persist between sessions.

---

## The ranking framework

Prices are dividend- and split-adjusted daily closes. All windows are counted in
**trading days**, backwards from the latest bar.

| Measure | Window | Definition |
|---|---|---|
| **12-1** | 252 → 21 days ago (231 days) | annualised return ÷ annualised volatility |
| **6-1** | 126 → 21 days ago (105 days) | annualised return ÷ annualised volatility |
| **Blended** | both | `0.5 × 12-1 + 0.5 × 6-1` |

Both horizons skip the most recent month, which is standard for momentum — the
latest month tends to mean-revert and would otherwise fight the signal.

- **Return is annualised geometrically**: `(1 + total return) ^ (252 / window days) − 1`,
  so a 231-day window and a 105-day window are directly comparable.
- **Volatility is measured over the identical window** as the return: standard
  deviation of daily log returns × √252.
- Because both horizons are return-per-unit-of-risk they share units, so the
  blend is a straight average with no hidden rescaling step.

Each measure gets a **global rank**, a **sector-relative rank**, and a
**sector-relative z-score**. Industries with at least 5 universe members also get
their own rank and z-score. Ranking is standard competition ranking, 1 = best:
ties share a rank and the following numbers are skipped.

Sector and industry series are **equal weight, rebalanced daily**, rebased to 100,
and then scored with exactly the same framework, so a sector rank means the same
thing as a stock rank.

### Portfolio risk

Basket volatility uses the full covariance matrix of daily returns over the last
252 overlapping sessions. Results are expressed as a normal day (1 standard
deviation), a rough day (1.96 standard deviations — exceeded in either direction
about one session in twenty), and a month — each in both percent and money.

Diversification is reported as **effective independent positions**: the
volatility of the basket compared against the weighted average volatility of its
parts. Hold five names that move as one and it reads 1.0; hold five genuinely
different bets and it approaches 5.

---

## How missing and messy data is handled

Nothing is silently repaired.

- **Short history** — a name needs 253 daily bars for a 12-1 score and 127 for a
  6-1 score. Without them it shows a dash and an explanation, never a score built
  from a shorter window. Missing either horizon means no blended score.
- **Duplicate listings** — companies with multiple share classes are collapsed to
  their most liquid line, matched on CIK where the provider supplies one and on a
  normalised company name otherwise. This build folded away GOOG, FOX, NWS, ZG and
  LLYVK.
- **Gaps** — a day a security did not trade is recorded as "no observation", never
  as a flat day, so a gap cannot masquerade as zero volatility. Chart lines break
  across gaps rather than drawing a false straight run.
- **Trading calendar** — the shared calendar is built from equity sessions only.
  Bitcoin trades weekends; letting its dates in would have stretched "252 trading
  days" across about nine months of real market activity. Non-equity instruments
  are sampled onto the equity calendar instead.
- **Correlations** — only dates where *every* selected holding traded are used, so
  relationships are measured on genuinely simultaneous observations.
- **Bad prints** — bars with a high below the low, a non-positive close, or a
  duplicated date are repaired or dropped, and the count is recorded in
  `data/manifest.json`.
- **Failures degrade** — if a logo, a secondary source or a single symbol fails,
  the universe, rankings, charts and portfolio maths carry on. Where a market was
  not available on the current API plan (crude futures history), a liquid ETF
  stands in and the substitution is labelled in the app.

---

## Rebuilding the data

```bash
export API_KEY=<your Financial Modeling Prep key>
npm install
npm run build:data
npm test
```

The pipeline caches every provider response on disk (`.cache/`, gitignored), so
re-running it after a config change costs seconds rather than re-downloading
everything.

### Widening the universe

Everything selectable lives in `config/universe.config.json`. Nothing downstream
is hard-coded to 25 names or to a particular sector list:

```jsonc
{
  "perSector": 25,              // raise for a deeper universe
  "sectors": [ ... ],           // add or remove sectors
  "screen":    { "minMarketCap": 2000000000, ... },
  "liquidity": { "minMedianDollarVolume": 10000000, "minPrice": 5, ... },
  "history":   { "years": 6, "minBarsRequired": 280 },
  "industries": { "minCountToTag": 5 },   // when an industry becomes its own group
  "appBundle": { "chartDays": 520 }       // how much history ships in the app
}
```

Selection order is: screen the market → keep the largest candidates per sector →
fetch real history → apply liquidity gates measured from actual bars (not a
screener snapshot) → collapse duplicate listings → take the top N per sector.

---

## Reusing the data

`data/` is plain JSON with no app-specific shaping, so other views can be built
from it without running the pipeline again:

| File | Contents |
|---|---|
| `data/universe.json` | 275 securities with scores, all ranks, z-scores, ATR, returns and score components |
| `data/sectors.json` | equal-weight sector and industry series with their ranks |
| `data/macro.json` | the five macro series on the equity calendar |
| `data/prices/<TICKER>.json` | full 6-year adjusted OHLCV, one file per ticker |
| `data/manifest.json` | build time, trading date, full config, and every data-quality note |

Per-ticker OHLCV is kept deliberately so rankings, charts, volatility, ATR and
sector series can all be recomputed locally without rebuilding the dataset. A
healthcare-only build, for instance, is a filter over `data/universe.json` plus
the matching files in `data/prices/` — no API calls.

---

## Tests

```bash
npm test
```

| Suite | What it proves |
|---|---|
| `test:analytics` | 66 checks of the maths against hand-computable cases — annualisation, tie-handling in ranks, ATR on known bars, equal-weight compounding, diversification of identical vs independent holdings |
| `test:data` | recomputes momentum and a whole sector index from the raw bar files, independently of the pipeline's own code path, and checks ranks, z-scores and bundle integrity |
| `test:app` | runs the app's real data layer and portfolio engine against the real dataset, including single-holding, zero-weight and 25-holding baskets |
| `test:render` | mounts the app and all ten screens against the real dataset in both themes, and asserts real content reaches the tree |

---

## Data sources

Prices, fundamentals, the screener and company logos come from
[Financial Modeling Prep](https://site.financialmodelingprep.com/). Each ticker
links to the company website and to Wikipedia for background. Logos load from the
provider's CDN with a monogram fallback, and are cached by the image layer.

The API key is read from the `API_KEY` environment variable by the pipeline only.
It is never written into the dataset, never committed, and never shipped to the
phone — the app contains data, not credentials.

---

*This is a research and educational tool. Nothing in it is investment advice, and
past movement is not a forecast of future movement.*

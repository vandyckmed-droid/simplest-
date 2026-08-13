# Stock App

You choose the stocks. The system calculates everything else.

The only actions the product ever offers are **look, sort, filter, inspect,
select, deselect**. Portfolio weights are never entered by hand — they are
derived. Every phase is built against that rule.

## Status — Phase 3: Ticker Detail

| Built | Not built yet |
| --- | --- |
| iPhone-first layout with safe-area handling | APIs and live data |
| Ranks screen: rank, logo, ticker, momentum blend, return | Any calculation |
| Select / deselect, persisted on the device | Sorting and filtering |
| Ticker detail: price, graph, 1M–2Y windows, three stats | Portfolio weighting |
| Swipe left/right through the ranked list | |
| Portfolio screen | |
| Bottom tab navigation | |
| Light and dark mode | |
| Design tokens and one shared row | |

All numbers on screen come from `src/data/fixtures.ts` and are literals —
the momentum scores, the returns, the portfolio total, the weights. Nothing
is computed.

### Selection

Tapping the disc on the right selects a stock; tapping it again deselects.
The chosen symbols live in `localStorage` under `stock-app.selection` and
survive a reload. Selection changes hue rather than weight — a filled green
puck would read louder than the ranking it sits beside.

`selectionStore.ts` is a module-level store read through `useSyncExternalStore`,
not per-component state, so Ranks, ticker detail, and Portfolio can never
disagree about what is selected.

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
Escape closes. The gesture locks to whichever axis it moves along first, so
scrolling the page never changes stock. It stops at both ends rather than
wrapping.

Price history in `src/data/series.ts` is fake, generated deterministically
from each stock's own volatility and 12–1 return and rescaled to end at the
fixture price. The same symbol always draws the same line.

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
  useSwipe.ts          axis-locked left/right gestures
  data/fixtures.ts     all fake data, in one place
  data/series.ts       deterministic fake price history
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
- The theme toggle round-trips and survives a reload
- No console errors, and `npm run build` passes strict typecheck

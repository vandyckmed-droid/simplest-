# Stock App

You choose the stocks. The system calculates everything else.

The only actions the product ever offers are **look, sort, filter, inspect,
select, deselect**. Portfolio weights are never entered by hand — they are
derived. Every phase is built against that rule.

## Status — Phase 1: App Shell

The visual foundation only. Two screens, bottom navigation, static fake data.

| Built | Not built yet |
| --- | --- |
| iPhone-first layout with safe-area handling | APIs and live data |
| Ranks screen | Any calculation |
| Portfolio screen | Charts |
| Bottom tab navigation | Sorting, filtering, inspection |
| Light and dark mode | Selection / deselection |
| Design tokens and shared row components | Portfolio logic |

All numbers on screen come from `src/data/fixtures.ts` and are literals —
including the portfolio total and the weights. Nothing is computed.

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
  data/fixtures.ts     all fake data, in one place
  components/
    Screen.tsx         title block, safe areas, section labels
    Row.tsx            the one list row both screens use
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
screens render, the tab bar switches and resets scroll, the last row and the
footnote clear the tab bar, nothing overflows horizontally, the theme toggle
round-trips and survives a reload, and there are no console errors.

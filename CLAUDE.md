# Stock App — project rules

## The one fundamental rule

The user chooses stocks; the system calculates everything else.

User actions are limited to **look, sort, filter, inspect, select, deselect**.
Portfolio weights are always automatic — never entered, never adjusted by hand.

## Permanent rules

- Own the repository and the implementation. Make routine technical decisions
  rather than asking.
- Build **only** the phase requested. Never implement future phases early.
- Keep the architecture simple, deterministic, modular, and easy to extend.
- Preserve and build on completed phases. Don't redesign working pieces
  without a reason.
- Test every phase before stopping.

## Design

iPhone first. Minimalist, Robinhood-influenced: large readable typography,
generous whitespace, simple rows, thin separators, black/white surfaces, a
restrained bright-green accent, excellent light and dark modes, minimal
visual clutter.

The visual language lives in `src/styles/tokens.css`. Components read tokens
and never hardcode a colour or a size.

## The development loop

Build → Test → Summarize checkpoints → Give test link → User reviews →
Refine → User approves → Next phase.

After completing every phase:

1. Deploy or run the current version and give a clickable link the user can
   open on a phone. Handle deployment, servers, and repository work — never
   ask the user to run commands or configure anything just to test.
2. Briefly summarize what the phase completed.
3. Maintain the Completed Checkpoints list below.
4. State the current phase/status and what remains intentionally unbuilt.
5. Keep the test version available while the user reviews.
6. Stop and wait for feedback.
7. Refine the current phase based on that feedback.
8. Do not begin the next phase without explicit approval.

Report in this format:

```
Completed Checkpoints
* ✓ Phase 0 — Empty Repository
* ✓ Phase 1 — App Shell
* ✓ Phase 2 — Ranks

Current Build
* Phase N complete
* Short summary of what was added
* Anything intentionally deferred

Test
* Clickable test link
```

## Completed checkpoints

- ✓ **Phase 0** — Empty repository
- ✓ **Phase 1** — App shell
- ✓ **Phase 2** — Ranks
- ✓ **Phase 3** — Ticker detail
- ✓ **Phase 4** — Basic portfolio

## Commands

```sh
npm install
npm run dev      # http://localhost:5173
npm run build    # strict typecheck + production build
npm run preview  # serve the production build
```

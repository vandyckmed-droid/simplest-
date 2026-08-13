import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A horizontal pager that follows the finger.
 *
 * Every page is mounted once, side by side in a single track, and only the
 * track's transform changes. That matters for more than tidiness: moving a
 * node in the DOM restarts its CSS animations, so a pager that recycled a
 * window of pages would replay the chart's draw on every swipe and flash as
 * the nodes were re-inserted. Nothing here moves, so nothing restarts.
 *
 * Committing a page is one continuous transition — the target offset changes
 * from "this page plus the drag" to "the next page", and CSS carries it the
 * rest of the way. There is no snap back to the middle.
 *
 * Vertical scrolling is untouched: the gesture locks to whichever axis it
 * moves along first, and `touch-action: pan-y` on the viewport leaves the
 * browser in charge of scrolling up and down.
 */

/** Travel before the gesture commits to an axis. */
const AXIS_LOCK_PX = 8;
/** Fraction of the width that counts as a page turn. */
const COMMIT_FRACTION = 0.25;
/** A flick this fast turns the page over a shorter distance (px per ms). */
const COMMIT_VELOCITY = 0.45;
/** Even a fast flick has to travel this far, so a twitch cannot page. */
const FLICK_FRACTION = 0.12;
/** Below this the gesture is too brief to time, so speed is not trusted. */
const MIN_TIMED_MS = 8;
/** How far past the ends the track will stretch. */
const EDGE_RESISTANCE = 0.3;
/** Settle time, matching the CSS transition. */
const SETTLE_MS = 280;

interface Carousel {
  /** Attach to the element that should receive the gesture. */
  rootRef: React.RefObject<HTMLElement>;
  /** Live drag offset of the track, in pixels. */
  offset: number;
  /** True while the track is settling, so CSS can ease it. */
  settling: boolean;
}

export function useCarousel(
  index: number,
  count: number,
  onIndexChange: (next: number) => void,
): Carousel {
  const rootRef = useRef<HTMLElement>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  const gesture = useRef<{
    startX: number;
    startY: number;
    startedAt: number;
    axis: 'x' | 'y' | null;
    width: number;
  } | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  // Kept in a ref so the native listeners never close over a stale value.
  const state = useRef({ index, count });
  state.current = { index, count };

  const settle = useCallback(
    (nextIndex: number) => {
      setSettling(true);
      // Both in one update: the transform target moves straight from where
      // the finger left it to where the new page sits, and eases across.
      setOffset(0);
      if (nextIndex !== state.current.index) onIndexChange(nextIndex);
      window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(() => setSettling(false), SETTLE_MS);
    },
    [onIndexChange],
  );

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        gesture.current = null;
        return;
      }
      window.clearTimeout(settleTimer.current);
      setSettling(false);
      const touch = event.touches[0];
      gesture.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startedAt: event.timeStamp,
        axis: null,
        width: root.clientWidth || 1,
      };
    };

    const onMove = (event: TouchEvent) => {
      const g = gesture.current;
      if (!g || g.axis === 'y') return;
      const touch = event.touches[0];
      const dx = touch.clientX - g.startX;
      const dy = touch.clientY - g.startY;

      if (g.axis === null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
        g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        if (g.axis === 'y') return;
      }

      // Dragging past the first or last stock stretches rather than moves.
      const { index: i, count: n } = state.current;
      const pulling = (dx > 0 && i === 0) || (dx < 0 && i === n - 1);
      setOffset(pulling ? dx * EDGE_RESISTANCE : dx);
    };

    const onEnd = (event: TouchEvent) => {
      const g = gesture.current;
      gesture.current = null;
      if (!g || g.axis !== 'x') return;

      const touch = event.changedTouches[0];
      const dx = touch.clientX - g.startX;
      const elapsed = Math.max(1, event.timeStamp - g.startedAt);
      const velocity = Math.abs(dx) / elapsed;
      const { index: i, count: n } = state.current;

      const far = Math.abs(dx) > g.width * COMMIT_FRACTION;
      const fast =
        elapsed >= MIN_TIMED_MS &&
        velocity > COMMIT_VELOCITY &&
        Math.abs(dx) > g.width * FLICK_FRACTION;
      const wantsNext = dx < 0 && i < n - 1;
      const wantsPrev = dx > 0 && i > 0;

      settle((far || fast) && (wantsNext || wantsPrev) ? i + (wantsNext ? 1 : -1) : i);
    };

    root.addEventListener('touchstart', onStart, { passive: true });
    root.addEventListener('touchmove', onMove, { passive: true });
    root.addEventListener('touchend', onEnd, { passive: true });
    root.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      root.removeEventListener('touchstart', onStart);
      root.removeEventListener('touchmove', onMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('touchcancel', onEnd);
    };
  }, [settle]);

  return { rootRef, offset, settling };
}

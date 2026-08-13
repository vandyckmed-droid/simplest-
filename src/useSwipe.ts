import { useRef } from 'react';
import type { TouchEvent } from 'react';

/** Horizontal travel needed before a drag counts as a swipe. */
const COMMIT_PX = 60;
/** Travel before the gesture commits to an axis. */
const AXIS_LOCK_PX = 10;

interface SwipeHandlers {
  onTouchStart: (event: TouchEvent) => void;
  onTouchMove: (event: TouchEvent) => void;
  onTouchEnd: (event: TouchEvent) => void;
}

/**
 * Left/right swipes, without stealing vertical scrolling. The gesture locks
 * to whichever axis it moves along first, so flicking down the page never
 * changes stock and a sideways swipe never jerks the scroll.
 */
export function useSwipe(onLeft: () => void, onRight: () => void): SwipeHandlers {
  const start = useRef<{ x: number; y: number } | null>(null);
  const axis = useRef<'x' | 'y' | null>(null);

  return {
    onTouchStart: (event) => {
      if (event.touches.length !== 1) {
        start.current = null;
        return;
      }
      const touch = event.touches[0];
      start.current = { x: touch.clientX, y: touch.clientY };
      axis.current = null;
    },

    onTouchMove: (event) => {
      if (!start.current || axis.current === 'y') return;
      const touch = event.touches[0];
      const dx = touch.clientX - start.current.x;
      const dy = touch.clientY - start.current.y;
      if (axis.current === null) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) < AXIS_LOCK_PX) return;
        axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
    },

    onTouchEnd: (event) => {
      const from = start.current;
      start.current = null;
      if (!from || axis.current !== 'x') return;
      const touch = event.changedTouches[0];
      const dx = touch.clientX - from.x;
      if (dx <= -COMMIT_PX) onLeft();
      else if (dx >= COMMIT_PX) onRight();
    },
  };
}

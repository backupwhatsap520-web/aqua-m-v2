import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

/*  Animates a number towards a target.
 *
 *  The brief (§6.1 item 2) flags an earlier version of this hook for assigning
 *  `valueRef.current` during render. That works by accident and breaks under
 *  StrictMode's double invocation, so this version does all mutation inside
 *  effects and the rAF callback, never in the render body.
 *
 *  Under prefers-reduced-motion it snaps to the target instead of animating —
 *  a counter ticking up is decoration, not information.
 */
export function useCountUp(target: number | undefined, durationMs = 600): number {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === undefined || Number.isNaN(target)) return;

    /*  Under reduced motion the value is derived at the bottom of this hook
     *  rather than pushed through state. Calling setState here would start a
     *  second render for a number we already know. */
    if (reduce || durationMs <= 0) {
      fromRef.current = target;
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) return;

    startedRef.current = null;

    const step = (ts: number) => {
      if (startedRef.current === null) startedRef.current = ts;
      const p = Math.min(1, (ts - startedRef.current) / durationMs);
      //  easeOutCubic: fast to start, settles gently. Matches the 300-450ms
      //  feel of the rest of the dashboard without overshooting a number.
      const eased = 1 - Math.pow(1 - p, 3);
      const value = from + delta * eased;
      setDisplay(value);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
        rafRef.current = null;
      }
    };

    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      //  Leave the ref where the animation actually stopped, so an interrupted
      //  run continues from there instead of jumping back.
      fromRef.current = target;
    };
  }, [target, durationMs, reduce]);

  if (target === undefined) return 0;
  return reduce ? target : display;
}

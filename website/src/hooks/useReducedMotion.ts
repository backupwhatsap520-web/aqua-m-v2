import { useEffect, useState } from 'react';

/*  Live-updating prefers-reduced-motion. Read once at mount is not enough:
 *  the user can change the OS setting while the dashboard is open, and a demo
 *  machine is exactly where someone might. */
export function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduce(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduce;
}

import { Suspense, lazy } from 'react';

/*  Three.js is by far the heaviest thing on the page. Splitting it out keeps
 *  the readings, the chart and the control panel interactive while the 3D
 *  chunk is still arriving, which matters on a school laptop on venue Wi-Fi.
 *
 *  The fallback reserves the exact height of the real view so nothing below it
 *  jumps when the chunk lands. */
const RailView = lazy(() => import('./RailView'));

type Props = {
  currentPot: number | null;
  planted: boolean;
  pumping: boolean;
  moving: boolean;
  degraded: boolean;
};

export function RailViewLazy(props: Props) {
  return (
    <Suspense
      fallback={
        <div
          className="h-[232px] w-full sm:h-[300px] lg:h-[376px]"
          aria-hidden="true"
        />
      }
    >
      <RailView {...props} />
    </Suspense>
  );
}

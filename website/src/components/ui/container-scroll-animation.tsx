import React, { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/*  Scroll-tilt container, adapted from the 21st.dev / Aceternity pattern.
 *
 *  Changes from the original snippet, all forced by this project rather than
 *  by preference:
 *
 *  - Vite, not Next.js: no `next/image`, no `@/` alias, no "use client".
 *  - framer-motion is published as `motion` now, so the import is
 *    `motion/react`. The API is the same.
 *  - The card holds a live dashboard, not a screenshot, so its inner surface
 *    is transparent and scrolls internally instead of clipping an image.
 *  - Reduced motion collapses the tilt entirely: a 20-degree rotation on
 *    scroll is exactly the kind of movement that setting exists to stop.
 *  - The frame is paper-and-ink rather than the original's dark chrome, to
 *    match the rest of the page.
 */

export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: React.ReactNode;
  children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: containerRef });

  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const rotate = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], isMobile ? [0.86, 1] : [1.04, 1]);
  const translate = useTransform(scrollYProgress, [0, 1], [0, -80]);

  return (
    <div ref={containerRef} className="relative flex items-center justify-center">
      <div className="w-full" style={{ perspective: '1200px' }}>
        <motion.div
          style={{ translateY: reduce ? 0 : translate }}
          className="mx-auto mb-phi-5 max-w-3xl text-center"
        >
          {titleComponent}
        </motion.div>

        <motion.div
          style={{
            rotateX: reduce ? 0 : rotate,
            scale: reduce ? 1 : scale,
            boxShadow:
              '0 2px 6px rgba(24,44,36,0.05), 0 18px 34px rgba(24,44,36,0.09), 0 54px 60px rgba(24,44,36,0.07)',
          }}
          className="mx-auto w-full rounded-[26px] border border-line bg-paper p-phi-2 sm:p-phi-3"
        >
          <div className="overflow-hidden rounded-[18px] bg-paper-2">{children}</div>
        </motion.div>
      </div>
    </div>
  );
}

export type { MotionValue };

import { useRef } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { useReducedMotion } from '../hooks/useReducedMotion';
import type { DeviceFeed } from '../hooks/useDeviceData';
import { Badge, Panel } from './primitives';

/*  Drop exists SOLELY so that useTransform is not called inside .map().
 *
 *  Hooks must run in the same order on every render. Calling useTransform once
 *  per item inside a loop makes the hook count depend on the list length, so
 *  the first time that list changes size React reads the wrong hook state and
 *  the component breaks — usually with a confusing error far from the cause.
 *
 *  Moving the hook into a child component gives each drop its own stable hook
 *  order. Do not "simplify" this back into the loop.
 */
function Drop({
  progress,
  x,
  delay,
  size,
  reduce,
}: {
  progress: MotionValue<number>;
  x: number;
  delay: number;
  size: number;
  reduce: boolean;
}) {
  const y = useTransform(progress, [0, 1], [0, 120 + delay * 90]);
  const opacity = useTransform(progress, [0, 0.15, 0.85, 1], [0, 0.55, 0.55, 0]);

  return (
    <motion.span
      aria-hidden="true"
      className="absolute top-0 rounded-full bg-gradient-to-b from-sky/70 to-aqua/10"
      style={{
        left: `${x}%`,
        width: size,
        height: size * 2.6,
        y: reduce ? 0 : y,
        opacity: reduce ? 0.25 : opacity,
      }}
    />
  );
}

const DROPS = [
  { x: 8, delay: 0.1, size: 5 },
  { x: 21, delay: 0.6, size: 3 },
  { x: 37, delay: 0.25, size: 6 },
  { x: 52, delay: 0.8, size: 4 },
  { x: 68, delay: 0.4, size: 5 },
  { x: 81, delay: 0.15, size: 3 },
  { x: 93, delay: 0.7, size: 4 },
];

const POTS = [1, 2, 3, 4, 5];

export function PortfolioTab({ feed }: { feed: DeviceFeed }) {
  const reduce = useReducedMotion();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });

  const currentPot = feed.data?.esp32_b?.status?.current_pot;

  return (
    <div className="space-y-4">
      {/* --- hero -------------------------------------------------------- */}
      <div ref={heroRef} className="glass relative overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {DROPS.map((d) => (
            <Drop
              key={`${d.x}-${d.delay}`}
              progress={scrollYProgress}
              x={d.x}
              delay={d.delay}
              size={d.size}
              reduce={reduce}
            />
          ))}
        </div>

        <div className="relative">
          <Badge tone="good">ISIF / IYSA</Badge>
          <h1 className="mt-4 text-3xl font-bold leading-tight text-slate-50 sm:text-4xl">
            Aqua-M V2
          </h1>
          <p className="mt-1 bg-aqua-gradient bg-clip-text text-lg font-semibold text-transparent">
            AI-Driven Hybrid Mobile Smart Irrigation Robot
          </p>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-300">
            A rail-guided robot drives between five pots, pushes a probe into the soil at each
            one, asks Gemini what the plant needs, and waters it. When the network is down a
            rule that runs entirely on the board takes over, so the plants still get water.
          </p>
        </div>
      </div>

      {/* --- how it works ------------------------------------------------ */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Two boards, one rail">
          <p className="text-sm leading-relaxed text-slate-300">
            ESP32 A holds every sensor and both pumps. ESP32 B holds the wheels and the arm.
            They talk over UART at 115200, which keeps working with the Wi-Fi switched off.
          </p>
        </Panel>
        <Panel title="Decides twice">
          <p className="text-sm leading-relaxed text-slate-300">
            Gemini decides how long to water. If it cannot be reached, a local threshold rule
            waters on soil moisture alone. Fertilising has no local rule on purpose — guessing
            a nutrient dose from a moisture reading is worse than waiting.
          </p>
        </Panel>
        <Panel title="Safe by construction">
          <p className="text-sm leading-relaxed text-slate-300">
            Relays are active-LOW, so a reset opens them. An actuator watchdog runs every loop
            and can only ever turn pumps off. No network call is issued while a pump runs.
          </p>
        </Panel>
      </div>

      {/* --- rail -------------------------------------------------------- */}
      <Panel
        title="The rail"
        action={
          <span className="text-xs text-slate-500">
            {currentPot === undefined ? 'position unknown' : `robot at pot ${currentPot}`}
          </span>
        }
      >
        <ol className="flex items-center gap-2 sm:gap-4">
          {POTS.map((p, i) => {
            const here = currentPot === p;
            return (
              <li key={p} className="flex flex-1 items-center gap-2 sm:gap-4">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border font-mono text-sm transition-colors duration-200 ${
                    here
                      ? 'border-aqua bg-aqua/15 text-aqua'
                      : 'border-hair bg-white/[0.03] text-slate-400'
                  }`}
                >
                  {p}
                  {here && <span className="sr-only"> (robot is here)</span>}
                </div>
                {i < POTS.length - 1 && (
                  <div className="h-px flex-1 bg-hair" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Position is counted from checkpoint lines, not measured absolutely. One missed line
          leaves the count wrong until the next power cycle — see RECOMMENDATIONS items 2
          and 29.
        </p>
      </Panel>

      {/* --- honesty ----------------------------------------------------- */}
      <Panel title="What has and has not been verified">
        <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
          <li className="flex gap-2">
            <span className="text-aqua">+</span>
            Both firmware sketches compile against ESP32 core 2.0.17 and 3.3.11, and against
            ArduinoJson 6 and 7 — 13 of 13 build combinations.
          </li>
          <li className="flex gap-2">
            <span className="text-aqua">+</span>
            172 software-in-the-loop checks pass, including every safety invariant: pump
            duration clamping, cooldown behaviour, and no network call while a pump runs.
          </li>
          <li className="flex gap-2">
            <span className="text-warn">!</span>
            Checkpoint counting degrades under infrared dropout: a third of crossings are
            miscounted at 5 % sample loss in simulation.
          </li>
          <li className="flex gap-2">
            <span className="text-slate-500">-</span>
            None of it has run on hardware. Every figure above is simulation, labelled SIL in
            the repository, and no timing here was measured on a board.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

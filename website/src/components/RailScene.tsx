import { useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useVelocity,
} from 'motion/react';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*  The rail, drawn rather than modelled.
 *
 *  Two layers with the robot between them: shelf behind, robot in the middle,
 *  pots in front. The pots overlapping the robot's base is what gives the
 *  scene depth — cheaper and more convincing than a camera.
 *
 *  It is not decoration. The robot stands at the pot ESP32 B reports in
 *  `current_pot`, and clicking a pot sends the same `goto` command the control
 *  panel sends. A pot you have asked for is marked as requested until the
 *  robot actually arrives, so the picture never claims a position the robot
 *  has not reached.
 *
 *  Motion blur is a horizontal-only Gaussian driven by the spring's own
 *  velocity, so it appears because the robot is moving rather than because a
 *  timer said so, and it falls to zero the moment it settles.
 */

const POTS = [1, 2, 3, 4, 5];
const VIEW_W = 1000;
const VIEW_H = 420;
const FIRST_X = 130;
const GAP = 185;

function potCx(pot: number) {
  return FIRST_X + (pot - 1) * GAP;
}

export function RailScene({
  currentPot,
  requestedPot,
  planted,
  pumping,
  degraded,
  onSelect,
  disabled,
}: {
  currentPot: number | null;
  requestedPot: number | null;
  planted: boolean;
  pumping: boolean;
  degraded: boolean;
  onSelect: (pot: number) => void;
  disabled: boolean;
}) {
  const reduce = useReducedMotion();

  const target = currentPot === null ? 3 : currentPot;
  const x = useMotionValue(potCx(target));

  /*  Soft spring: a carriage on a belt arrives and settles, it does not snap.
   *  Under reduced motion the spring is stiff enough to be instant. */
  const springX = useSpring(x,
    reduce
      ? { stiffness: 1000, damping: 100 }
      : { stiffness: 78, damping: 17, mass: 1.05 },
  );

  const velocity = useVelocity(springX);
  /*  Blur tracks speed and is horizontal only, which is what a camera would
   *  actually record for something travelling sideways. */
  const blurAmount = useTransform(velocity, [-1500, 0, 1500], [13, 0, 13], {
    clamp: true,
  });
  const blurStd = useTransform(blurAmount, (v) => `${reduce ? 0 : v.toFixed(2)} 0`);

  //  A little lean into the direction of travel sells the weight.
  const lean = useTransform(velocity, [-1500, 0, 1500], [4.5, 0, -4.5], { clamp: true });

  useEffect(() => {
    x.set(potCx(target));
  }, [target, x]);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className={`h-auto w-full ${degraded ? 'opacity-45' : ''} transition-opacity duration-500`}
        role="img"
        aria-label={
          degraded
            ? 'Rail: no position data available.'
            : `Rail: robot at pot ${currentPot ?? 'unknown'}, watering can ${
                planted ? 'lowered' : 'raised'
              }.`
        }
      >
        <defs>
          <filter id="motion-blur" x="-30%" y="-10%" width="160%" height="120%">
            <motion.feGaussianBlur stdDeviation={blurStd} />
          </filter>

          <linearGradient id="canBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3FC8E0" />
            <stop offset="100%" stopColor="#17B9D6" />
          </linearGradient>
        </defs>

        {/* --- layer 1: the shelf the pots stand on --------------------- */}
        <g>
          <rect x="24" y="330" width={VIEW_W - 48} height="13" rx="6" fill="#C9D1C4" />
          <rect x="24" y="343" width={VIEW_W - 48} height="7" rx="3" fill="#AFBAAA" />
          {/*  Checkpoint marks: what the infrared pair actually counts. */}
          {POTS.map((p) => (
            <rect key={p} x={potCx(p) - 3} y="330" width="6" height="13" fill="#8B9789" />
          ))}
        </g>

        {/* --- layer 2: the robot, behind the pots ---------------------- */}
        <motion.g
          style={{ x: springX, rotate: lean, originX: '0px', originY: '300px' }}
          filter="url(#motion-blur)"
        >
          <g transform="translate(-52, 96)">
            {/* shadow */}
            <ellipse cx="52" cy="232" rx="46" ry="8" fill="#16241E" opacity="0.10" />

            {/* treads */}
            <rect x="8" y="196" width="88" height="30" rx="15" fill="#4F6459" />
            <circle cx="26" cy="211" r="8" fill="#93A192" />
            <circle cx="52" cy="211" r="8" fill="#93A192" />
            <circle cx="78" cy="211" r="8" fill="#93A192" />

            {/* body */}
            <rect x="16" y="130" width="72" height="70" rx="16" fill="#F2EFE6" />
            <rect x="16" y="130" width="72" height="70" rx="16" fill="none" stroke="#C7CFC2" strokeWidth="2.5" />
            <rect x="30" y="152" width="44" height="7" rx="3.5" fill="#06D6A0" />

            {/* neck */}
            <rect x="46" y="112" width="12" height="24" rx="6" fill="#93A192" />

            {/* head: binocular housing with two eyes */}
            <motion.g
              animate={{ y: planted ? 6 : 0, rotate: planted ? 7 : 0 }}
              transition={{ type: 'spring', stiffness: 140, damping: 16 }}
              style={{ originX: '52px', originY: '112px' }}
            >
              <rect x="20" y="76" width="64" height="40" rx="14" fill="#EAE6DB" />
              <rect x="20" y="76" width="64" height="40" rx="14" fill="none" stroke="#C7CFC2" strokeWidth="2.5" />
              <circle cx="38" cy="96" r="12" fill="#2E3F38" />
              <circle cx="66" cy="96" r="12" fill="#2E3F38" />
              <motion.g
                animate={{ scaleY: planted ? 0.55 : 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }}
                style={{ originY: '96px' }}
              >
                <circle cx="38" cy="96" r="7" fill="#06D6A0" />
                <circle cx="66" cy="96" r="7" fill="#06D6A0" />
                <circle cx="40.5" cy="93" r="2.4" fill="#EAFBF5" />
                <circle cx="68.5" cy="93" r="2.4" fill="#EAFBF5" />
              </motion.g>
            </motion.g>

            {/* --- the watering can, held out to one side --------------- */}
            <motion.g
              animate={{ rotate: planted ? -26 : -4, y: planted ? 8 : 0 }}
              transition={{ type: 'spring', stiffness: 130, damping: 15 }}
              style={{ originX: '92px', originY: '160px' }}
            >
              {/* arm */}
              <rect x="84" y="152" width="30" height="11" rx="5.5" fill="#93A192" />
              {/* can body */}
              <path
                d="M108 148 h34 a7 7 0 0 1 7 7 v30 a7 7 0 0 1 -7 7 h-34 a7 7 0 0 1 -7 -7 v-30 a7 7 0 0 1 7 -7 z"
                fill="url(#canBody)"
              />
              {/* handle */}
              <path
                d="M116 148 q9 -17 22 -2"
                fill="none"
                stroke="#0E8FA8"
                strokeWidth="6"
                strokeLinecap="round"
              />
              {/* spout */}
              <path d="M149 158 l24 14 l-6 10 l-20 -12 z" fill="#17B9D6" />
              <ellipse cx="171" cy="180" rx="7" ry="4.5" fill="#0E8FA8" transform="rotate(30 171 180)" />

              {/* water, only while a pump is running */}
              {pumping && (
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.circle
                      key={i}
                      cx={174 + i * 5}
                      cy={188}
                      r={3 - i * 0.5}
                      fill="#3FC8E0"
                      animate={reduce ? {} : { cy: [188, 226], opacity: [0.95, 0] }}
                      transition={
                        reduce
                          ? {}
                          : { duration: 0.75, repeat: Infinity, delay: i * 0.18, ease: 'easeIn' }
                      }
                    />
                  ))}
                </motion.g>
              )}
            </motion.g>
          </g>
        </motion.g>

        {/* --- layer 3: the pots, in front ------------------------------ */}
        <g>
          {POTS.map((p) => {
            const cx = potCx(p);
            const here = currentPot === p;
            return (
              <g key={p}>
                {/* foliage */}
                <g transform={`translate(${cx} 262)`}>
                  {[-1, 0, 1].map((d, i) => (
                    <ellipse
                      key={d}
                      cx={d * 17}
                      cy={-16 - i * 4}
                      rx="15"
                      ry="26"
                      transform={`rotate(${d * 26} ${d * 17} ${-16 - i * 4})`}
                      fill={here ? '#A9D96A' : '#8CC63F'}
                      opacity={0.92 - i * 0.06}
                    />
                  ))}
                  <ellipse cx="0" cy="-40" rx="12" ry="21" fill={here ? '#B7E27C' : '#9ACF4E'} />
                </g>
                {/* pot */}
                <path
                  d={`M${cx - 34} 262 h68 l-8 62 a10 10 0 0 1 -10 8 h-32 a10 10 0 0 1 -10 -8 z`}
                  fill={here ? '#D8A87C' : '#C99A70'}
                />
                <rect x={cx - 38} y="254" width="76" height="14" rx="6" fill={here ? '#E0B489' : '#D2A67C'} />
              </g>
            );
          })}
        </g>

        {/* --- hit targets, above everything --------------------------- */}
        {POTS.map((p) => {
          const cx = potCx(p);
          const here = currentPot === p;
          const asked = requestedPot === p && !here;
          return (
            <g key={`hit-${p}`}>
              <rect
                x={cx - 46}
                y="212"
                width="92"
                height="130"
                rx="12"
                fill="transparent"
                stroke={here ? '#06D6A0' : asked ? '#17B9D6' : 'transparent'}
                strokeWidth="2.5"
                strokeDasharray={asked ? '6 5' : undefined}
                className={disabled ? '' : 'cursor-pointer'}
                onClick={() => !disabled && onSelect(p)}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={`Send the robot to pot ${p}${here ? ', where it is now' : ''}`}
                onKeyDown={(e) => {
                  if (disabled) return;
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(p);
                  }
                }}
              />
              <text
                x={cx}
                y="360"
                textAnchor="middle"
                className="num"
                fontSize="15"
                fill={here ? '#04A67C' : asked ? '#0E8FA8' : '#4F6459'}
                fontWeight={here || asked ? 600 : 400}
              >
                {p}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default RailScene;

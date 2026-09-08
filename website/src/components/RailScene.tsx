import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useVelocity } from 'motion/react';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*  The rail, drawn rather than modelled.
 *
 *  Three layers with the robot in the middle: shelf behind, robot, pots in
 *  front. The pots crossing the robot's legs is what gives the scene depth,
 *  which is cheaper and more convincing than a camera.
 *
 *  HOW THE OCCLUSION IS KEPT HONEST
 *
 *  A first pass had the pot and its leaves standing at exactly the robot's own
 *  x, so they buried it from the chest down. Three things fix that without
 *  losing the depth:
 *    - the pot is low and wide rather than tall, so its rim crosses the shins
 *    - the leaves splay outward and none grows vertically, leaving a clear
 *      channel up the middle for the body and head
 *    - the robot is tall enough that head and torso clear the foliage entirely
 *
 *  It is not decoration. The robot stands at the pot ESP32 B reports in
 *  `current_pot`, and clicking a pot sends the same `goto` the control panel
 *  sends. A pot you have asked for is dashed until the board confirms arrival,
 *  so the picture never claims a position the robot has not reached.
 *
 *  Motion blur is a horizontal-only Gaussian driven by the spring's own
 *  velocity: it appears because the robot is moving, not because a timer said
 *  so, and falls to zero the moment it settles.
 */

const POTS = [1, 2, 3, 4, 5];
const VIEW_W = 1000;
const VIEW_H = 400;
const FIRST_X = 132;
const GAP = 184;

/*  The vertical plan, so future edits do not have to reverse-engineer it:
 *    head      152 - 208
 *    torso     212 - 300
 *    treads    300 - 336   <- crossed by the pot
 *    pot rim   292 - 308
 *    foliage   236 - 294   <- splayed, clear up the centre
 *    shelf     336 - 352                                                    */
const SHELF_Y = 336;

function potCx(pot: number) {
  return FIRST_X + (pot - 1) * GAP;
}

/*  The robot parks beside the pot it is serving and reaches across with the
 *  can, rather than standing behind it. Two reasons, and the second is the
 *  one that matters: it is what anyone watering a plant actually does, and it
 *  leaves the machine fully visible instead of buried behind the foliage. It
 *  still passes behind the pots while travelling, which is where the layering
 *  earns its keep. */
const PARK_OFFSET = -96;

function robotX(pot: number) {
  return potCx(pot) + PARK_OFFSET;
}

/* --- one potted plant ----------------------------------------------------- */
function Pot({ cx, active }: { cx: number; active: boolean }) {
  const clay = active ? '#D9A578' : '#C6905F';
  const clayLit = active ? '#E7BD95' : '#D6A87B';
  const clayShade = active ? '#B98457' : '#A87446';
  const leaf = active ? '#9BD152' : '#84BE3C';
  const leafDeep = active ? '#77B33B' : '#649A2C';

  /*  Leaves lean out to both sides. None is vertical, which is what keeps the
   *  channel up the middle open for the robot behind. */
  const leaves = [
    { a: -64, len: 46, w: 15, fill: leafDeep, y: -4 },
    { a: -34, len: 56, w: 17, fill: leaf, y: -8 },
    { a: 34, len: 54, w: 17, fill: leaf, y: -8 },
    { a: 62, len: 44, w: 14, fill: leafDeep, y: -4 },
  ];

  return (
    <g>
      {/* foliage, drawn from the rim */}
      <g transform={`translate(${cx} 292)`}>
        {leaves.map((l) => (
          <g key={l.a} transform={`rotate(${l.a}) translate(0 ${l.y})`}>
            {/* stem */}
            <path
              d={`M0 0 Q ${l.w * 0.2} ${-l.len * 0.55} 0 ${-l.len}`}
              stroke={leafDeep}
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
            />
            {/* blade, asymmetric so it does not read as a logo */}
            <path
              d={`M0 ${-l.len * 0.35}
                  C ${l.w} ${-l.len * 0.62}, ${l.w * 0.9} ${-l.len * 1.05}, 0 ${-l.len * 1.12}
                  C ${-l.w * 0.85} ${-l.len * 1.0}, ${-l.w} ${-l.len * 0.6}, 0 ${-l.len * 0.35} Z`}
              fill={l.fill}
            />
            {/* midrib */}
            <path
              d={`M0 ${-l.len * 0.4} L0 ${-l.len * 1.06}`}
              stroke={leafDeep}
              strokeWidth="1.6"
              opacity="0.55"
              strokeLinecap="round"
            />
          </g>
        ))}
        {/* one short sprout, off centre */}
        <path
          d="M6 -2 q10 -16 3 -28"
          stroke={leafDeep}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>

      {/* soil, just visible above the rim */}
      <ellipse cx={cx} cy="294" rx="33" ry="7" fill="#6B5238" />
      <ellipse cx={cx - 8} cy="292" rx="9" ry="3" fill="#7C6144" opacity="0.8" />

      {/* body: low and wide, tapering */}
      <path
        d={`M${cx - 36} 302 h72 l-7 30 a9 9 0 0 1 -9 6 h-40 a9 9 0 0 1 -9 -6 z`}
        fill={clay}
      />
      {/* the lit left face, so it is not a flat silhouette */}
      <path d={`M${cx - 36} 302 h20 l-4 36 h-8 a9 9 0 0 1 -8 -6 z`} fill={clayLit} opacity="0.75" />
      <path d={`M${cx + 22} 302 h14 l-7 30 a9 9 0 0 1 -7 6 z`} fill={clayShade} opacity="0.6" />

      {/* rim */}
      <rect x={cx - 40} y="290" width="80" height="16" rx="7" fill={clay} />
      <rect x={cx - 40} y="290" width="80" height="6" rx="3" fill={clayLit} />
      <rect x={cx - 40} y="302" width="80" height="4" rx="2" fill={clayShade} opacity="0.55" />

      {/* contact shadow on the shelf */}
      <ellipse cx={cx} cy="339" rx="34" ry="5" fill="#16241E" opacity="0.13" />
    </g>
  );
}

/* --- the robot ------------------------------------------------------------ */
function RobotArt({ planted, pumping, reduce }: { planted: boolean; pumping: boolean; reduce: boolean }) {
  const shell = '#F4F1E8';
  const shellShade = '#DCD8CB';
  const outline = '#B9C0B2';
  const metal = '#8E9C8D';
  const metalDark = '#5D6E60';

  return (
    <g transform="translate(-54 0)">
      {/* ground shadow */}
      <ellipse cx="54" cy="338" rx="44" ry="7" fill="#16241E" opacity="0.12" />

      {/* --- treads ---------------------------------------------------- */}
      <rect x="8" y="300" width="92" height="34" rx="17" fill={metalDark} />
      <rect x="12" y="304" width="84" height="26" rx="13" fill={metal} />
      {[24, 42, 60, 78].map((x) => (
        <rect key={x} x={x} y="304" width="5" height="26" rx="2.5" fill={metalDark} opacity="0.45" />
      ))}
      <circle cx="26" cy="317" r="7.5" fill={shellShade} />
      <circle cx="82" cy="317" r="7.5" fill={shellShade} />
      <circle cx="26" cy="317" r="3" fill={metalDark} />
      <circle cx="82" cy="317" r="3" fill={metalDark} />

      {/* --- torso ------------------------------------------------------ */}
      <rect x="14" y="212" width="80" height="90" rx="18" fill={shell} />
      <path d="M74 212 h2 a18 18 0 0 1 18 18 v54 a18 18 0 0 1 -18 18 h-2 z" fill={shellShade} opacity="0.7" />
      <rect x="14" y="212" width="80" height="90" rx="18" fill="none" stroke={outline} strokeWidth="2.4" />
      {/* panel seam */}
      <path d="M14 262 h80" stroke={outline} strokeWidth="1.6" opacity="0.7" />
      {/* chest readout */}
      <rect x="28" y="226" width="52" height="26" rx="7" fill="#E7E3D6" stroke={outline} strokeWidth="1.6" />
      <rect x="34" y="233" width="30" height="4" rx="2" fill="#06D6A0" />
      <rect x="34" y="241" width="18" height="4" rx="2" fill="#06D6A0" opacity="0.5" />
      <circle cx="72" cy="239" r="3.5" fill={pumping ? '#17B9D6' : '#C3CCC1'} />
      {/* latch */}
      <rect x="44" y="274" width="20" height="8" rx="4" fill={metal} />

      {/* --- neck ------------------------------------------------------- */}
      <rect x="47" y="196" width="14" height="24" rx="7" fill={metal} />
      <rect x="44" y="204" width="20" height="5" rx="2.5" fill={metalDark} opacity="0.5" />

      {/* --- head ------------------------------------------------------- */}
      <motion.g
        animate={{ y: planted ? 7 : 0, rotate: planted ? 8 : 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 16 }}
        style={{ originX: '54px', originY: '200px' }}
      >
        {/* antenna */}
        <path d="M54 156 v-16" stroke={metal} strokeWidth="3" strokeLinecap="round" />
        <circle cx="54" cy="136" r="4.5" fill="#17B9D6" />

        <rect x="18" y="152" width="72" height="48" rx="17" fill={shell} />
        <path d="M70 152 h2 a17 17 0 0 1 17 17 v14 a17 17 0 0 1 -17 17 h-2 z" fill={shellShade} opacity="0.65" />
        <rect x="18" y="152" width="72" height="48" rx="17" fill="none" stroke={outline} strokeWidth="2.4" />

        {/* the two lenses */}
        {[38, 70].map((cx, i) => (
          <g key={cx}>
            <circle cx={cx} cy="176" r="14" fill="#2E3F38" />
            <circle cx={cx} cy="176" r="14" fill="none" stroke={metalDark} strokeWidth="2" />
            <motion.g
              animate={{ scaleY: planted ? 0.5 : 1 }}
              transition={{ type: 'spring', stiffness: 210, damping: 18 }}
              style={{ originY: '176px' }}
            >
              <circle cx={cx} cy="176" r="8" fill="#06D6A0" />
              <circle cx={cx + 2.6} cy="172.6" r="2.8" fill="#F0FFFA" />
              <circle cx={cx - 3} cy="180" r="1.4" fill="#F0FFFA" opacity="0.5" />
            </motion.g>
            {i === 0 && <path d="M24 164 q6 -5 13 -3" stroke={outline} strokeWidth="2" fill="none" opacity="0.8" />}
          </g>
        ))}
      </motion.g>

      {/* --- arm and watering can --------------------------------------- */}
      <motion.g
        animate={{ rotate: planted ? -28 : -6, y: planted ? 10 : 0 }}
        transition={{ type: 'spring', stiffness: 130, damping: 15 }}
        style={{ originX: '94px', originY: '246px' }}
      >
        {/* shoulder and arm */}
        <circle cx="94" cy="246" r="9" fill={metal} />
        <rect x="92" y="240" width="30" height="12" rx="6" fill={metal} />
        <rect x="92" y="240" width="30" height="4" rx="2" fill="#A9B5A7" />

        {/* can */}
        <path
          d="M116 232 h36 a8 8 0 0 1 8 8 v32 a8 8 0 0 1 -8 8 h-36 a8 8 0 0 1 -8 -8 v-32 a8 8 0 0 1 8 -8 z"
          fill="#22BFD8"
        />
        <path d="M116 232 h11 v48 h-11 a8 8 0 0 1 -8 -8 v-32 a8 8 0 0 1 8 -8 z" fill="#4CD3E8" opacity="0.85" />
        <rect x="108" y="246" width="52" height="4" rx="2" fill="#0E8FA8" opacity="0.45" />
        {/* handle */}
        <path d="M124 232 q11 -20 26 -3" fill="none" stroke="#0E8FA8" strokeWidth="6.5" strokeLinecap="round" />
        {/* spout */}
        <path d="M160 242 l26 15 l-7 12 l-22 -13 z" fill="#22BFD8" />
        <path d="M160 242 l26 15 l-3 5 l-24 -14 z" fill="#4CD3E8" opacity="0.7" />
        <ellipse cx="184" cy="266" rx="8" ry="5" fill="#0E8FA8" transform="rotate(30 184 266)" />

        {pumping && (
          <g>
            {[0, 1, 2].map((i) => (
              <motion.ellipse
                key={i}
                cx={186 + i * 4}
                cy={276}
                rx={2.6 - i * 0.4}
                ry={3.6 - i * 0.5}
                fill="#3FC8E0"
                animate={reduce ? {} : { cy: [276, 322], opacity: [0.95, 0] }}
                transition={
                  reduce ? {} : { duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeIn' }
                }
              />
            ))}
          </g>
        )}
      </motion.g>
    </g>
  );
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
  const x = useMotionValue(robotX(target));

  /*  A carriage on a belt arrives and settles; it does not snap. Under reduced
   *  motion the spring is stiff enough to be effectively instant. */
  const springX = useSpring(
    x,
    reduce ? { stiffness: 1000, damping: 100 } : { stiffness: 78, damping: 17, mass: 1.05 },
  );

  const velocity = useVelocity(springX);
  const blurAmount = useTransform(velocity, [-1500, 0, 1500], [13, 0, 13], { clamp: true });
  const blurStd = useTransform(blurAmount, (v) => `${reduce ? 0 : v.toFixed(2)} 0`);
  //  A little lean into the direction of travel sells the weight.
  const lean = useTransform(velocity, [-1500, 0, 1500], [4, 0, -4], { clamp: true });

  useEffect(() => {
    x.set(robotX(target));
  }, [target, x]);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className={`h-auto w-full transition-opacity duration-500 ${degraded ? 'opacity-45' : ''}`}
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
        <filter id="motion-blur" x="-40%" y="-10%" width="180%" height="120%">
          <motion.feGaussianBlur stdDeviation={blurStd} />
        </filter>
      </defs>

      {/* --- layer 1: the shelf --------------------------------------- */}
      <g>
        <rect x="20" y={SHELF_Y} width={VIEW_W - 40} height="12" rx="6" fill="#CBD3C6" />
        <rect x="20" y={SHELF_Y} width={VIEW_W - 40} height="5" rx="2.5" fill="#DDE3D8" />
        <rect x="20" y={SHELF_Y + 12} width={VIEW_W - 40} height="6" rx="3" fill="#AEBAA9" />
        {POTS.map((p) => (
          <rect key={p} x={potCx(p) - 3} y={SHELF_Y} width="6" height="12" fill="#8B9789" />
        ))}
      </g>

      {/* --- layer 2: the robot, behind the pots ---------------------- */}
      <motion.g style={{ x: springX, rotate: lean, originX: '0px', originY: '330px' }} filter="url(#motion-blur)">
        <RobotArt planted={planted} pumping={pumping} reduce={reduce} />
      </motion.g>

      {/* --- layer 3: the pots, in front ------------------------------ */}
      <g>
        {POTS.map((p) => (
          <Pot key={p} cx={potCx(p)} active={currentPot === p} />
        ))}
      </g>

      {/* --- hit targets ---------------------------------------------- */}
      {POTS.map((p) => {
        const cx = potCx(p);
        const here = currentPot === p;
        const asked = requestedPot === p && !here;
        return (
          <g key={`hit-${p}`}>
            <rect
              x={cx - 48}
              y="228"
              width="96"
              height="122"
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
              y="374"
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
  );
}

export default RailScene;

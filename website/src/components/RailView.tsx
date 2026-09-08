import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { Robot } from './Robot';

/*  The rail, seen from the side and slightly above.
 *
 *  Not decoration. The carriage sits at the pot ESP32 B reports in
 *  `current_pot`, the head tips down and the arm drops when the mission state
 *  says the probe is in the soil, and the nozzle lights when a pump runs. If
 *  the dashboard and the robot ever disagree, it shows here before it shows in
 *  a number.
 *
 *  Low-poly on purpose: no shadow maps, no post-processing, no loaded models.
 *  It has to hold its frame rate on a school laptop next to a live chart.
 */

const POT_COUNT = 5;
const PHI = 1.618;
/*  Pot spacing and rail overhang are golden-ratio related, so the run of pots
 *  and the empty ends read as one proportion rather than as arbitrary gaps. */
const SPACING = 1.5;
const OVERHANG = SPACING / PHI;
const RAIL_HALF = ((POT_COUNT - 1) * SPACING) / 2;
const RAIL_SPAN = RAIL_HALF * 2 + OVERHANG * 2;

function potX(pot: number) {
  return -RAIL_HALF + (pot - 1) * SPACING;
}

const ACCENT = '#06D6A0';


function Rail() {
  return (
    <group>
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[RAIL_SPAN, 0.075, 0.3]} />
        <meshStandardMaterial color="#3D3059" roughness={0.7} metalness={0.35} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (RAIL_HALF + OVERHANG * 0.72), -0.5, 0]}>
          <boxGeometry args={[0.1, 0.28, 0.36]} />
          <meshStandardMaterial color="#65538C" roughness={0.55} metalness={0.4} />
        </mesh>
      ))}
      {/*  Checkpoint lines: what the infrared pair actually counts. */}
      {Array.from({ length: POT_COUNT }, (_, i) => (
        <mesh key={i} position={[potX(i + 1), -0.581, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 0.3]} />
          <meshBasicMaterial color="#191426" />
        </mesh>
      ))}
    </group>
  );
}

function Pot({ pot, active }: { pot: number; active: boolean }) {
  return (
    <group position={[potX(pot), -1.02, 0]}>
      <mesh>
        <cylinderGeometry args={[0.27, 0.21, 0.33, 20]} />
        <meshStandardMaterial
          color={active ? '#4E3E70' : '#302647'}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      <mesh position={[0, 0.17, 0]}>
        <cylinderGeometry args={[0.245, 0.245, 0.02, 20]} />
        <meshStandardMaterial color="#1C1729" roughness={1} />
      </mesh>
      {/*  Foliage reads green against the violet everywhere else, which is the
          whole point of the split-complementary palette. */}
      {[0, 2.1, 4.2].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.09, 0.31 + i * 0.042, Math.sin(a) * 0.09]}
          rotation={[0.34 * Math.cos(a), a, 0.34 * Math.sin(a)]}
        >
          <coneGeometry args={[0.08, 0.28, 5]} />
          <meshStandardMaterial color={active ? '#3FA37B' : '#2E7159'} roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Carriage({
  targetPot,
  planted,
  pumping,
  moving,
  reduce,
}: {
  targetPot: number | null;
  planted: boolean;
  pumping: boolean;
  moving: boolean;
  reduce: boolean;
}) {
  const rig = useRef<THREE.Group>(null);
  const goalX = targetPot === null ? 0 : potX(targetPot);

  useFrame((_, dt) => {
    if (!rig.current) return;
    if (reduce) {
      rig.current.position.x = goalX;
      return;
    }
    //  Critically damped: settles without overshoot, which is what a
    //  belt-driven carriage does.
    const k = 1 - Math.exp(-5.5 * dt);
    rig.current.position.x += (goalX - rig.current.position.x) * k;
  });

  return (
    <group ref={rig} position={[goalX, 0, 0]}>
      <Robot planted={planted} pumping={pumping} moving={moving} reduce={reduce} />
    </group>
  );
}

const FOV = 40;
const MARGIN = 1.02;   // just enough air; the rail should fill the panel

/*  oxlint's react(immutability) rule fires on writing to `camera`. Mutating the
 *  camera is the documented react-three-fiber pattern — the scene graph is a
 *  Three.js tree, not React state — and the declarative alternative from drei
 *  fails silently against R3F 9 on React 19. Mutation it is, deliberately. */
function FitCamera() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useEffect(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const halfFov = (FOV * Math.PI) / 360;
    const needed = (RAIL_SPAN * MARGIN) / (2 * Math.tan(halfFov) * aspect);
    camera.position.set(0.3, 0.3, Math.max(needed, 3.2));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);

  return null;
}

function Scene({
  currentPot,
  planted,
  pumping,
  moving,
  reduce,
}: {
  currentPot: number | null;
  planted: boolean;
  pumping: boolean;
  moving: boolean;
  reduce: boolean;
}) {
  const pots = useMemo(() => Array.from({ length: POT_COUNT }, (_, i) => i + 1), []);
  return (
    <group position={[0, 0.46, 0]}>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} color="#EDE7FA" />
      {/*  Bounce from the accent side, so the machine picks up a little of the
          green it carries rather than being lit only by white. */}
      <directionalLight position={[-4, 2, -3]} intensity={0.5} color={ACCENT} />
      <pointLight position={[0, 1.4, 2.4]} intensity={4} distance={12} color="#D7CCF0" />

      <Rail />
      {pots.map((p) => (
        <Pot key={p} pot={p} active={currentPot === p} />
      ))}
      <Carriage
        targetPot={currentPot}
        planted={planted}
        pumping={pumping}
        moving={moving}
        reduce={reduce}
      />

    </group>
  );
}

export function RailView({
  currentPot,
  planted,
  pumping,
  moving,
  degraded,
}: {
  currentPot: number | null;
  planted: boolean;
  pumping: boolean;
  moving: boolean;
  /** No database: the scene renders, dimmed, with the carriage parked centre. */
  degraded: boolean;
}) {
  const reduce = useReducedMotion();

  return (
    //  Height is roughly the panel width divided by phi at each breakpoint.
    <div className="relative h-[232px] w-full sm:h-[300px] lg:h-[376px]">
      <Canvas
        // camera is set by FitCamera so it can react to the panel size
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        className={degraded ? 'opacity-40 transition-opacity duration-500' : ''}
      >
        <FitCamera />
        <Suspense fallback={null}>
          <Scene
            currentPot={degraded ? null : currentPot}
            planted={!degraded && planted}
            pumping={!degraded && pumping}
            moving={!degraded && moving}
            reduce={reduce}
          />
        </Suspense>
      </Canvas>

      <p className="sr-only">
        {degraded
          ? 'Rail view: no position data available.'
          : `Rail view: carriage at pot ${currentPot ?? 'unknown'}, probe ${
              planted ? 'lowered into the soil' : 'raised'
            }, pump ${pumping ? 'running' : 'off'}.`}
      </p>
    </div>
  );
}

export default RailView;

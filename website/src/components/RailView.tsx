import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*  The rail, seen from the side and slightly above.
 *
 *  This is not decoration. The carriage sits at the pot ESP32 B reports in
 *  `current_pot`, the arm drops when the mission state says the probe is in
 *  the soil, and the nozzle lights when a pump is running. If the dashboard
 *  and the robot ever disagree, you can see it here before you see it in a
 *  number.
 *
 *  Kept deliberately low-poly: no shadow maps, no post-processing, no loaded
 *  models. It has to hold 60fps on a school laptop next to a live chart.
 */

const POT_COUNT = 5;
const SPACING = 1.5;
const RAIL_HALF = ((POT_COUNT - 1) * SPACING) / 2;

/** World X for pot 1..5. Pot 1 is at the left end. */
function potX(pot: number) {
  return -RAIL_HALF + (pot - 1) * SPACING;
}

const AQUA = '#06D6A0';
const INK = '#16352B';   // the bench the rail stands on, inside the painting

function Rail() {
  return (
    <group>
      {/* beam */}
      <mesh position={[0, -0.62, 0]}>
        <boxGeometry args={[RAIL_HALF * 2 + 1.4, 0.09, 0.34]} />
        <meshStandardMaterial color="#2A5A4C" roughness={0.75} metalness={0.35} />
      </mesh>
      {/* end stops */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (RAIL_HALF + 0.7), -0.5, 0]}>
          <boxGeometry args={[0.12, 0.32, 0.4]} />
          <meshStandardMaterial color="#44866F" roughness={0.6} metalness={0.4} />
        </mesh>
      ))}
      {/* checkpoint lines, one per pot: what the IR pair actually counts */}
      {Array.from({ length: POT_COUNT }, (_, i) => (
        <mesh key={i} position={[potX(i + 1), -0.567, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.07, 0.34]} />
          <meshBasicMaterial color="#10241F" />
        </mesh>
      ))}
    </group>
  );
}

function Pot({ pot, active }: { pot: number; active: boolean }) {
  const x = potX(pot);
  return (
    <group position={[x, -1.05, 0]}>
      <mesh>
        <cylinderGeometry args={[0.3, 0.23, 0.36, 20]} />
        <meshStandardMaterial
          color={active ? '#1E4438' : '#1A2231'}
          roughness={0.9}
          metalness={0.05}
        />
      </mesh>
      {/* soil */}
      <mesh position={[0, 0.185, 0]}>
        <cylinderGeometry args={[0.27, 0.27, 0.02, 20]} />
        <meshStandardMaterial color="#151B14" roughness={1} />
      </mesh>
      {/* three leaves, angled apart so it reads as a plant not a cone */}
      {[0, 2.1, 4.2].map((a, i) => (
        <mesh
          key={i}
          position={[Math.cos(a) * 0.1, 0.34 + i * 0.045, Math.sin(a) * 0.1]}
          rotation={[0.34 * Math.cos(a), a, 0.34 * Math.sin(a)]}
        >
          <coneGeometry args={[0.085, 0.3, 5]} />
          <meshStandardMaterial
            color={active ? '#2E7D5B' : '#25543F'}
            roughness={0.85}
          />
        </mesh>
      ))}
      {/* pot number, etched into the rail base rather than floated as a label */}
      <mesh position={[0, -0.19, 0.24]} rotation={[-0.5, 0, 0]}>
        <planeGeometry args={[0.16, 0.16]} />
        <meshBasicMaterial color={active ? AQUA : '#26303F'} transparent opacity={0.85} />
      </mesh>
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
  const body = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const nozzle = useRef<THREE.MeshStandardMaterial>(null);

  const goalX = targetPot === null ? 0 : potX(targetPot);
  const goalArm = planted ? -0.44 : 0;

  useFrame((state, dt) => {
    if (!body.current || !arm.current) return;

    if (reduce) {
      body.current.position.x = goalX;
      arm.current.position.y = goalArm;
    } else {
      //  Critically damped approach rather than a linear tween: it settles
      //  without overshoot, which is what a belt-driven carriage does.
      const k = 1 - Math.exp(-6 * dt);
      body.current.position.x += (goalX - body.current.position.x) * k;
      arm.current.position.y += (goalArm - arm.current.position.y) * k * 0.9;

      //  A hint of vertical play only while actually driving.
      const t = state.clock.elapsedTime;
      body.current.position.y = moving ? Math.sin(t * 9) * 0.006 : 0;
    }

    if (nozzle.current) {
      const want = pumping ? 1.9 : 0.05;
      nozzle.current.emissiveIntensity +=
        (want - nozzle.current.emissiveIntensity) * (reduce ? 1 : 0.12);
    }
  });

  return (
    <group ref={body} position={[goalX, 0, 0]}>
      {/* chassis */}
      <mesh position={[0, -0.38, 0]}>
        <boxGeometry args={[0.62, 0.26, 0.42]} />
        <meshStandardMaterial color="#212B3A" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* accent stripe: the only coloured surface on the machine */}
      <mesh position={[0, -0.28, 0.212]}>
        <planeGeometry args={[0.5, 0.035]} />
        <meshBasicMaterial color={AQUA} />
      </mesh>
      {/* mast */}
      <mesh position={[0.17, -0.06, 0]}>
        <boxGeometry args={[0.09, 0.42, 0.09]} />
        <meshStandardMaterial color="#2B3648" roughness={0.55} metalness={0.45} />
      </mesh>

      {/* arm assembly: drops when the probe is planted */}
      <group ref={arm}>
        <mesh position={[-0.04, 0.1, 0]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[0.42, 0.06, 0.07]} />
          <meshStandardMaterial color="#2B3648" roughness={0.55} metalness={0.45} />
        </mesh>
        {/* probe shaft */}
        <mesh position={[-0.2, -0.12, 0]}>
          <cylinderGeometry args={[0.017, 0.017, 0.34, 8]} />
          <meshStandardMaterial color="#7E8CA3" roughness={0.35} metalness={0.7} />
        </mesh>
        {/* nozzle tip: lights while a pump runs */}
        <mesh position={[-0.2, -0.3, 0]}>
          <sphereGeometry args={[0.036, 12, 12]} />
          <meshStandardMaterial
            ref={nozzle}
            color={AQUA}
            emissive={AQUA}
            emissiveIntensity={0.05}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

/*  Pull the camera back until the whole rail fits.
 *
 *  The same scene is used in a very wide, short panel on the monitoring tab and
 *  in a narrower hero column on the project tab. With a fixed camera the narrow
 *  one crops to three pots, which is worse than useless: it shows the wrong
 *  rail. Distance is derived from the aspect ratio instead. */
const RAIL_SPAN = RAIL_HALF * 2 + 1.4;
const MARGIN = 1.1;

const FOV = 40;

function FitCamera() {
  const size = useThree((s) => s.size);

  const z = useMemo(() => {
    const aspect = size.width / Math.max(size.height, 1);
    const halfFov = (FOV * Math.PI) / 360;
    //  Distance that makes the visible width equal the rail plus a margin,
    //  with a floor so it never gets uncomfortably close on ultra-wide panels.
    const needed = (RAIL_SPAN * MARGIN) / (2 * Math.tan(halfFov) * aspect);
    return Math.max(needed, 3.6);
  }, [size.width, size.height]);

  //  Declared rather than mutated: drei swaps the default camera for this one,
  //  so resizing re-renders it instead of us writing to a hook's return value.
  return <PerspectiveCamera makeDefault fov={FOV} position={[0.45, 0.6, z]} />;
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
  //  Lift the whole rig so the rail sits near the optical centre; the canvas is
  //  wide and short, so vertical framing is the scarce resource here.
  return (
    <group position={[0, 0.78, 0]}>
      <FitCamera />
      <ambientLight intensity={1.15} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} color="#DCE6F5" />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} color={AQUA} />
      <pointLight position={[0, 1.6, 2.2]} intensity={7} distance={12} color="#B9CBE6" />
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
      {/* A shallow ground catch, kept small and low so it reads as a bench
          surface rather than drawing a horizon across the frame. */}
      <mesh position={[0, -1.245, 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[11, 2.6]} />
        <meshStandardMaterial color={INK} roughness={1} />
      </mesh>
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
    <div className="relative h-[280px] w-full sm:h-[340px] lg:h-[400px]">
      <Canvas
        // camera is declared by FitCamera so it can react to the panel size
        dpr={[1, 1.75]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        className={degraded ? 'opacity-35 transition-opacity duration-500' : ''}
      >
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

      {/*  The scene is decorative to a screen reader; the same facts are in the
          readouts beside it, so it is labelled rather than described. */}
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

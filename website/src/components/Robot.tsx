import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/*  The carriage, built as a character rather than a box.
 *
 *  A boxy body on treads, a neck, and a binocular head with two lit eyes —
 *  the shape everyone recognises from the film about the robot that carries a
 *  plant around, which happens to be exactly what this machine does. It is not
 *  a copy of that design: no yellow, no shoulder hydraulics, no cube-crusher
 *  torso. It borrows the silhouette that reads as "small working robot" and
 *  keeps the palette and proportions of this project.
 *
 *  Proportions are golden-ratio derived. The body is 1 unit wide; the head is
 *  1/phi of that, the tread base phi times the body height, and the neck sits
 *  at 1/phi up the body.
 *
 *  Everything animates from data:
 *    - the head turns toward the pot it is working on
 *    - the eyes narrow when the probe is planted, as if looking down at it
 *    - a slow blink, off a per-instance phase so it never looks metronomic
 *    - the treads bob only while actually driving
 */

const PHI = 1.618;
const BODY_W = 0.5;
const BODY_H = BODY_W / PHI;          // 0.309
const HEAD_W = BODY_W / PHI;          // 0.309
const ACCENT = '#06D6A0';

export function Robot({
  planted,
  pumping,
  moving,
  reduce,
}: {
  planted: boolean;
  pumping: boolean;
  moving: boolean;
  reduce: boolean;
}) {
  const chassis = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const nozzle = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const k = reduce ? 1 : 1 - Math.exp(-7 * dt);

    //  Head: tips down over the pot while the probe is in the soil, and looks
    //  level while driving. Small idle drift so it never reads as frozen.
    if (head.current) {
      const goalPitch = planted ? 0.42 : 0.06;
      const drift = reduce || moving ? 0 : Math.sin(t * 0.6) * 0.05;
      head.current.rotation.x += (goalPitch - head.current.rotation.x) * k;
      head.current.rotation.y += (drift - head.current.rotation.y) * k * 0.5;
    }

    //  Arm down when planted.
    if (arm.current) {
      const goal = planted ? -0.3 : 0;
      arm.current.position.y += (goal - arm.current.position.y) * k * 0.9;
    }

    //  Tread bob, only while driving.
    if (chassis.current) {
      chassis.current.position.y = reduce || !moving ? 0 : Math.sin(t * 11) * 0.007;
    }

    //  Blink: a short close roughly every four seconds, plus a squint while
    //  the probe is planted. Eyelids are scaled rather than moved so they stay
    //  attached to the eye.
    if (lidL.current && lidR.current) {
      const cycle = (t % 4.1) / 4.1;
      const blink = !reduce && cycle > 0.965 ? 1 : 0;
      const squint = planted ? 0.34 : 0;
      const closed = Math.max(blink, squint);
      const sy = 1 - closed * 0.86;
      lidL.current.scale.y += (sy - lidL.current.scale.y) * (reduce ? 1 : 0.35);
      lidR.current.scale.y = lidL.current.scale.y;
    }

    if (nozzle.current) {
      const want = pumping ? 2.2 : 0.04;
      nozzle.current.emissiveIntensity +=
        (want - nozzle.current.emissiveIntensity) * (reduce ? 1 : 0.12);
    }
  });

  return (
    <group ref={chassis}>
      {/* --- treads: two blocks with roller detail ---------------------- */}
      {[-1, 1].map((s) => (
        <group key={s} position={[0, -0.42, s * 0.17]}>
          <mesh>
            <boxGeometry args={[BODY_W * PHI, BODY_H * 0.62, 0.1]} />
            <meshStandardMaterial color="#2E2545" roughness={0.85} metalness={0.2} />
          </mesh>
          {[-0.28, 0, 0.28].map((x) => (
            <mesh key={x} position={[x, -0.02, 0.052]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.052, 0.052, 0.012, 12]} />
              <meshStandardMaterial color="#4E3E70" roughness={0.6} metalness={0.4} />
            </mesh>
          ))}
        </group>
      ))}

      {/* --- body -------------------------------------------------------- */}
      <mesh position={[0, -0.24, 0]}>
        <boxGeometry args={[BODY_W, BODY_H, 0.34]} />
        <meshStandardMaterial color="#3B2F59" roughness={0.55} metalness={0.35} />
      </mesh>
      {/*  The one coloured surface on the machine. */}
      <mesh position={[0, -0.24, 0.171]}>
        <planeGeometry args={[BODY_W * 0.72, 0.028]} />
        <meshBasicMaterial color={ACCENT} />
      </mesh>

      {/* --- neck and head ---------------------------------------------- */}
      <mesh position={[0, -0.09, 0]}>
        <cylinderGeometry args={[0.032, 0.038, 0.17, 10]} />
        <meshStandardMaterial color="#4E3E70" roughness={0.5} metalness={0.45} />
      </mesh>

      <group ref={head} position={[0, 0.02, 0]}>
        {/* binocular housing */}
        <mesh>
          <boxGeometry args={[HEAD_W, HEAD_W * 0.56, 0.14]} />
          <meshStandardMaterial color="#453869" roughness={0.5} metalness={0.4} />
        </mesh>
        {/* the two eyes, and their lids */}
        {[-1, 1].map((s, i) => (
          <group key={s} position={[s * HEAD_W * 0.26, 0.005, 0.075]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.058, 0.058, 0.03, 20]} />
              <meshStandardMaterial color="#20193A" roughness={0.35} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.017]}>
              <circleGeometry args={[0.042, 20]} />
              <meshStandardMaterial
                color={ACCENT}
                emissive={ACCENT}
                emissiveIntensity={1.5}
                roughness={0.2}
              />
            </mesh>
            {/* lid: scaled down over the eye to blink and to squint */}
            <mesh ref={i === 0 ? lidL : lidR} position={[0, 0, 0.02]}>
              <planeGeometry args={[0.1, 0.1]} />
              <meshBasicMaterial color="#453869" />
            </mesh>
          </group>
        ))}
      </group>

      {/* --- side arms, purely structural -------------------------------- */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (BODY_W / 2 + 0.03), -0.26, 0]}>
          <boxGeometry args={[0.04, 0.13, 0.05]} />
          <meshStandardMaterial color="#4E3E70" roughness={0.55} metalness={0.4} />
        </mesh>
      ))}

      {/* --- probe arm, the part that does the work ---------------------- */}
      <group ref={arm}>
        <mesh position={[-0.2, -0.16, 0.14]} rotation={[0, 0, 0.42]}>
          <boxGeometry args={[0.3, 0.045, 0.05]} />
          <meshStandardMaterial color="#4E3E70" roughness={0.5} metalness={0.45} />
        </mesh>
        <mesh position={[-0.33, -0.3, 0.14]}>
          <cylinderGeometry args={[0.014, 0.014, 0.26, 8]} />
          <meshStandardMaterial color="#AFA3C8" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[-0.33, -0.44, 0.14]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial
            ref={nozzle}
            color={ACCENT}
            emissive={ACCENT}
            emissiveIntensity={0.04}
            roughness={0.3}
          />
        </mesh>
      </group>
    </group>
  );
}

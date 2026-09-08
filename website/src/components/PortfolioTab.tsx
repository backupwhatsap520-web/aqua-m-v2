import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowsLeftRight,
  Broadcast as BroadcastIcon,
  CloudSlash,
  Magnet as MagnetIcon,
  Medal,
  ShieldCheck,
  Thermometer as ThermometerIcon,
  Users,
  UsersThree as UsersThreeIcon,
} from '@phosphor-icons/react';
import type { DeviceFeed } from '../hooks/useDeviceData';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*  Everything about the project, below the dashboard.
 *
 *  Six sections, six different layout families: an offset two-column with a
 *  spine, a horizontal step sequence, a before-and-after split, an award
 *  block, a team plate, and a two-by-two roadmap. Repeating one layout is
 *  what makes a page read as generated, so none of them repeats.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, delay, ease: EASE },
});

/*  Names as the team gave them, in the order given. Deliberately NOT captioned
 *  onto faces in the photograph: nobody has told us who is who, and putting
 *  the wrong name under a person is worse than leaving the group uncaptioned. */
const TEAM = [
  'Rizqullah Aufa Rozhie',
  "Nu'man Abdurrahman",
  'Fachri Tri Putra',
  'Pradani Adzfar Hafidz',
  'Muhammad Danendra Kurnia Ramadhan',
  'Chico Rafif Fakhrishi',
];

export function PortfolioTab(_props: { feed: DeviceFeed }) {
  const reduce = useReducedMotion();
  const anim = (delay = 0) => (reduce ? {} : reveal(delay));

  /*  The photograph is dropped in by the team rather than bundled, so the page
   *  has to survive it not being there yet. */
  const [photoMissing, setPhotoMissing] = useState(false);

  return (
    <div className="space-y-phi-6 pb-phi-5 sm:space-y-phi-7">
      {/* --- 1. how it decides: offset columns with a spine -------------- */}
      <section className="grid gap-phi-5 lg:grid-cols-[1fr_1.618fr] lg:gap-phi-6">
        <motion.h2
          {...anim()}
          className="text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl"
        >
          Two ways to decide, and a rule about which one wins
        </motion.h2>

        <div className="space-y-phi-5">
          {[
            {
              icon: <CloudSlash size={20} className="text-cyan-deep" />,
              head: 'Gemini decides how long to water',
              body: 'The board posts soil moisture, pH, temperature, humidity, light and the local weather straight to Google AI Studio. No server sits in between. The reply is clamped to ten seconds of water and five of fertiliser before it can reach a pump.',
            },
            {
              icon: <ArrowsLeftRight size={20} className="text-cyan-deep" />,
              head: 'The board decides when the network fails',
              body: 'Below 30 percent soil moisture it waters for eight seconds, between 30 and 60 for four, above that not at all. Over 35 degrees adds two seconds. Fertiliser has no offline rule on purpose: guessing a nutrient dose from a moisture reading is worse than waiting.',
            },
            {
              icon: <ShieldCheck size={20} className="text-cyan-deep" />,
              head: 'The firmware always has the last word',
              body: 'Relays are active-low, so a reset opens them. A watchdog runs every loop and can only ever turn a pump off. No network call is issued while a pump is running, because a slow reply would outlast the watering it was meant to control.',
            },
          ].map((item, i) => (
            <motion.article key={item.head} {...anim(0.08 * i)} className="rule-l pl-phi-4">
              <div className="mb-phi-2 flex items-center gap-phi-2">
                {item.icon}
                <h3 className="text-base font-medium text-ink">{item.head}</h3>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* --- 2. the run, as a horizontal sequence ------------------------ */}
      <section>
        <motion.h2
          {...anim()}
          className="mb-phi-5 text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl"
        >
          One visit to one pot
        </motion.h2>

        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: 'Drive',
              d: 'ESP32 A sends TARGET:3. The motion board counts checkpoint lines under the rail until it reaches the third.',
            },
            {
              t: 'Plant',
              d: 'The arm lowers the probe into the soil and reports SENSOR_READY. Two seconds to settle before anything is read.',
            },
            {
              t: 'Read and decide',
              d: 'Soil, pH, air and light are sampled, then either Gemini or the local rule sets a duration.',
            },
            {
              t: 'Water and lift',
              d: 'The pump runs for exactly that long, the arm lifts, and the robot is free to move again.',
            },
          ].map((step, i) => (
            <motion.div key={step.t} {...anim(0.06 * i)} className="bg-paper-2 p-phi-4">
              <span className="num mb-phi-3 block text-xs text-cyan-deep">{`0${i + 1}`}</span>
              <h3 className="mb-phi-2 text-sm font-medium text-ink">{step.t}</h3>
              <p className="text-[13px] leading-relaxed text-ink-muted">{step.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --- 3. V1 to V2: a before and after ----------------------------- */}
      <section>
        <motion.h2
          {...anim()}
          className="mb-phi-5 max-w-2xl text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl"
        >
          The first one could not move
        </motion.h2>

        <div className="grid gap-phi-4 md:grid-cols-2">
          <motion.div {...anim()} className="surface p-phi-4 sm:p-phi-5">
            <p className="num mb-phi-3 text-xs uppercase tracking-[0.16em] text-ink-muted">
              Aqua-M V1
            </p>
            <p className="mb-phi-3 text-phi-lg font-semibold text-ink">One pot</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              V1 stood in one place and looked after the plant in front of it. It could read
              the soil and it could water, and for a single pot that was enough. Add a second
              plant and you needed a second robot, which is not a system so much as a
              duplicate.
            </p>
          </motion.div>

          <motion.div
            {...anim(0.1)}
            className="surface border-cyan/35 bg-cyan-wash p-phi-4 sm:p-phi-5"
          >
            <p className="num mb-phi-3 text-xs uppercase tracking-[0.16em] text-cyan-deep">
              Aqua-M V2
            </p>
            <p className="mb-phi-3 text-phi-lg font-semibold text-ink">Five pots, one robot</p>
            <p className="text-sm leading-relaxed text-ink-soft">
              V2 moves. A rail, a second board for motion, checkpoint lines to count by, and
              an arm that plants the probe at each stop. One set of sensors and one pump now
              serve five plants, and the decision is made per pot rather than per machine.
            </p>
          </motion.div>
        </div>

        <motion.p {...anim(0.16)} className="mt-phi-4 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Almost everything hard about V2 comes from that one change. A machine that stays
          still always knows where it is. A machine that moves has to work it out, which is
          why checkpoint counting, the UART link between the two boards and the mission state
          machine all exist.
        </motion.p>
      </section>

      {/* --- 4. the award ------------------------------------------------ */}
      <section>
        <motion.div
          {...anim()}
          className="surface flex flex-col gap-phi-4 p-phi-5 sm:flex-row sm:items-center sm:gap-phi-6"
        >
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-leaf-wash">
            <Medal size={30} className="text-leaf-deep" weight="duotone" />
          </div>
          <div>
            <h2 className="text-phi-lg font-semibold tracking-tightest text-ink">
              Gold medal, and a special award
            </h2>
            <p className="mt-phi-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
              Aqua-M V1 took a gold medal at the competition held at UNIKOM Bandung, together
              with the ICGI special award. V2 is the version built after that, and the reason
              it exists is the limitation the judges were looking at: a robot that can only
              ever tend the plant directly in front of it.
            </p>
          </div>
        </motion.div>
      </section>

      {/* --- 5. the team ------------------------------------------------- */}
      <section className="grid gap-phi-5 lg:grid-cols-phi lg:gap-phi-6">
        <motion.div {...anim()}>
          <div className="overflow-hidden rounded-xl border border-line bg-paper-3">
            {photoMissing ? (
              <div className="flex aspect-[4/5] flex-col items-center justify-center gap-phi-3 p-phi-5 text-center">
                <Users size={28} className="text-ink-muted" />
                <p className="text-sm text-ink-muted">
                  Team photograph goes here.
                  <br />
                  Save it as <code className="num text-[12px]">website/public/team.jpg</code>.
                </p>
              </div>
            ) : (
              <img
                src="/team.jpg"
                alt="The six students who built Aqua-M, standing together in school uniform."
                className="h-auto w-full object-cover"
                loading="lazy"
                onError={() => setPhotoMissing(true)}
              />
            )}
          </div>
        </motion.div>

        <motion.div {...anim(0.1)}>
          <h2 className="mb-phi-4 text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl">
            Six people built this
          </h2>
          <p className="mb-phi-4 max-w-md text-sm leading-relaxed text-ink-soft">
            Students at MAN 4 Jakarta. The paper, the firmware, the rail and this dashboard
            are all theirs.
          </p>
          <ul className="divide-y divide-line border-y border-line">
            {TEAM.map((name, i) => (
              <motion.li
                key={name}
                {...anim(0.04 * i)}
                className="flex items-baseline gap-phi-3 py-phi-3"
              >
                <span className="num w-6 shrink-0 text-xs text-ink-muted">{`0${i + 1}`}</span>
                <span className="text-sm text-ink">{name}</span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </section>

      {/* --- 6. what comes next ----------------------------------------- */}
      <section>
        <motion.div {...anim()} className="mb-phi-5 max-w-2xl">
          <h2 className="text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl">
            What comes after V2
          </h2>
          <p className="mt-phi-3 text-sm leading-relaxed text-ink-soft">
            None of this is built yet, and the hardware for V2 itself has not arrived. These
            are the four directions the team is working towards, and each one exists because
            of a limit V2 still has.
          </p>
        </motion.div>

        <div className="grid gap-phi-4 md:grid-cols-2">
          {[
            {
              icon: <BroadcastIcon size={22} className="text-cyan-deep" weight="duotone" />,
              head: 'LoRa instead of Wi-Fi',
              limit: 'Today the robot needs a Wi-Fi access point within range.',
              body: 'LoRa carries a few hundred bytes over kilometres on very little power. A greenhouse or a field is exactly the case Wi-Fi is worst at, and the messages this robot sends are small enough to fit.',
            },
            {
              icon: <ThermometerIcon size={22} className="text-cyan-deep" weight="duotone" />,
              head: 'More to measure',
              limit: 'Soil moisture, pH, air and light only tell part of the story.',
              body: 'Nitrogen, phosphorus and potassium would let the fertiliser decision rest on something real rather than on a schedule. A flow sensor would turn seconds of pump time into millilitres of water, which is a much stronger claim than the one the paper can make now.',
            },
            {
              icon: <UsersThreeIcon size={22} className="text-cyan-deep" weight="duotone" />,
              head: 'Several small robots instead of one big one',
              limit: 'One robot on one rail is a single point of failure.',
              body: 'Smaller units, light enough to carry in one hand, could cover a row each and be moved wherever the plants are. If one stops, the others keep going, and a demo no longer depends on a single machine surviving the journey.',
            },
            {
              icon: <MagnetIcon size={22} className="text-cyan-deep" weight="duotone" />,
              head: 'Magnetic plug-and-play parts',
              limit: 'Changing a sensor now means a screwdriver and a rewire.',
              body: 'Magnetic mounts with pogo-pin contacts would let the probe, the arm or a whole sensor head come off and go back on in seconds. Repair mid-competition stops being a risk, and one chassis can be reconfigured for a different crop.',
            },
          ].map((item, i) => (
            <motion.article key={item.head} {...anim(0.07 * i)} className="surface p-phi-4 sm:p-phi-5">
              <div className="mb-phi-3 flex items-center gap-phi-3">
                {item.icon}
                <h3 className="text-base font-medium text-ink">{item.head}</h3>
              </div>
              <p className="mb-phi-3 border-l-2 border-line-strong pl-phi-3 text-[13px] leading-relaxed text-ink-muted">
                {item.limit}
              </p>
              <p className="text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </motion.article>
          ))}
        </div>
      </section>
    </div>
  );
}

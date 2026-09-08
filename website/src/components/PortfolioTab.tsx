import { motion } from 'motion/react';
import { ArrowsLeftRight, CloudSlash, ShieldCheck } from '@phosphor-icons/react';
import type { DeviceFeed } from '../hooks/useDeviceData';
import { useReducedMotion } from '../hooks/useReducedMotion';

/*  The judge-facing side of the dashboard.
 *
 *  Deliberately NOT built from the same repeated card grid as the monitoring
 *  tab. Four sections, four different layout families: asymmetric split hero,
 *  offset two-column with a numbered spine, a horizontal step sequence, and a
 *  figures-and-prose block. One eyebrow on the whole page.
 */

const EASE = [0.16, 1, 0.3, 1] as const;

/*  Scroll reveal, for sections below the fold. */
const reveal = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, delay, ease: EASE },
});

/*  Kept for reference: the hero that used to live here moved into the page
 *  shell above the dashboard frame, and animates on entry there. */

export function PortfolioTab(_props: { feed: DeviceFeed }) {
  const reduce = useReducedMotion();
  const anim = (delay = 0) => (reduce ? {} : reveal(delay));

  return (
    <div className="space-y-phi-6 pb-phi-5 sm:space-y-phi-7">
      {/* --- how it decides: offset columns with a numbered spine ------- */}
      <section className="grid gap-phi-5 lg:grid-cols-[1fr_1.618fr] lg:gap-phi-6">
        <motion.h2
          {...anim()}
          className="text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl"
        >
          Two ways to decide, and a rule about which one wins
        </motion.h2>

        <div className="space-y-8">
          {[
            {
              icon: <CloudSlash size={20} className="text-accent" />,
              head: 'Gemini decides how long to water',
              body: 'The board posts soil, pH, temperature, humidity, light and the local weather straight to Google AI Studio. No server sits in between. The reply is clamped to ten seconds of water and five of fertiliser before it can reach a pump.',
            },
            {
              icon: <ArrowsLeftRight size={20} className="text-accent" />,
              head: 'The board decides when the network fails',
              body: 'Below 30 percent soil moisture it waters for eight seconds, between 30 and 60 for four, above that not at all. Over 35 degrees adds two seconds. Fertiliser has no offline rule on purpose: guessing a nutrient dose from a moisture reading is worse than waiting.',
            },
            {
              icon: <ShieldCheck size={20} className="text-accent" />,
              head: 'The firmware always has the last word',
              body: 'Relays are active-low, so a reset opens them. A watchdog runs every loop and can only ever turn a pump off. No network call is issued while a pump is running, because a slow reply would outlast the watering it was meant to control.',
            },
          ].map((item, i) => (
            <motion.article
              key={item.head}
              {...anim(0.08 * i)}
              className="rule-l pl-5 sm:pl-6"
            >
              <div className="mb-2 flex items-center gap-2.5">
                {item.icon}
                <h3 className="text-base font-medium text-ink">{item.head}</h3>
              </div>
              <p className="max-w-xl text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* --- 3. the run, as a horizontal sequence -------------------------- */}
      <section>
        <motion.h2
          {...anim()}
          className="mb-phi-5 text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl"
        >
          One visit to one pot
        </motion.h2>

        <div className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            { t: 'Drive', d: 'ESP32 A sends TARGET:3. The motion board counts checkpoint lines under the rail until it reaches the third.' },
            { t: 'Plant', d: 'The arm lowers the probe into the soil and reports SENSOR_READY. Two seconds to settle before anything is read.' },
            { t: 'Read and decide', d: 'Soil, pH, air and light are sampled, then either Gemini or the local rule sets a duration.' },
            { t: 'Water and lift', d: 'The pump runs for exactly that long, the arm lifts, and the robot is free to move again.' },
          ].map((step, i) => (
            <motion.div key={step.t} {...anim(0.06 * i)} className="bg-paper-2 p-5">
              <span className="num mb-3 block text-xs text-accent">{`0${i + 1}`}</span>
              <h3 className="mb-2 text-sm font-medium text-ink">{step.t}</h3>
              <p className="text-[13px] leading-relaxed text-ink-muted">{step.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* --- 4. what is proven, in figures and plain sentences ------------- */}
      <section className="grid gap-phi-5 lg:grid-cols-phi lg:gap-phi-6">
        <div>
          <motion.h2
            {...anim()}
            className="mb-phi-4 text-phi-lg font-semibold tracking-tightest text-ink sm:text-phi-xl"
          >
            What has actually been checked
          </motion.h2>

          <motion.dl {...anim(0.08)} className="grid grid-cols-2 gap-6">
            {[
              { n: '13', l: 'build combinations, all passing', s: 'two ESP32 core generations, two ArduinoJson versions' },
              { n: '172', l: 'software-in-the-loop checks', s: 'every safety invariant among them' },
              { n: '44%', l: 'of flash used on ESP32 A', s: 'room left for the whole system again' },
              { n: '0', l: 'hardware measurements', s: 'the boards had not arrived' },
            ].map((f) => (
              <div key={f.l}>
                <dt className="num text-phi-lg font-medium text-ink sm:text-phi-xl">{f.n}</dt>
                <dd className="mt-1.5 text-sm text-ink-soft">{f.l}</dd>
                <dd className="mt-0.5 text-xs leading-relaxed text-ink-muted">{f.s}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div {...anim(0.12)} className="space-y-4 text-sm leading-relaxed text-ink-soft">
          <p>
            Every figure on this page comes from simulation, not from a robot. The firmware
            was compiled and driven on a PC with a virtual clock, which is how a two-minute
            pump cooldown can be tested in one line instead of two minutes.
          </p>
          <p>
            That rules out whole classes of logic bug. It does not tell you what the pump
            does at twenty percent battery, whether the infrared sensors survive stage
            lighting, or how the servo behaves when the motors draw current.
          </p>
          <p className="border-l-2 border-warn/40 pl-4 text-ink-muted">
            One finding is worth knowing before a demo. Under simulated infrared dropout the
            checkpoint counter misses a third of crossings at five percent sample loss. Since
            position is counted rather than measured, one missed line leaves the robot at the
            wrong pot for the rest of the run.
          </p>
        </motion.div>
      </section>
    </div>
  );
}

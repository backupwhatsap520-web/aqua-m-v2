# Design review — findings and recommendations

Three passes over the specification and the finished code. Section A is what
needs a decision from the team. Section B is already fixed in the code you have.
Section C is worth doing before a competition demo but does not block anything.

---

## A. Needs your decision

**1. Checkpoint sensor roles — resolved, now matching the hardware.**
`CHECKPOINT_USES_INNER_SENSORS` is now `0`: the **outer** pair detects the
checkpoint lines, the **inner** pair follows the track. This is also the more
robust arrangement physically, since the outer sensors sit off the track and
only read black when crossing a perpendicular line.

Two consequences worth knowing:

- The paper's locked parameter describes a dual-**inner**-sensor 50 ms debounce.
  The firmware now describes the outer pair. The 50 ms debounce itself is
  unchanged, so the number in the paper still holds; only which physical pair it
  refers to has moved. Decide as a team whether that needs a footnote, an errata
  note, or nothing at all. Everyone in the room should be able to answer if a
  judge asks why the code and the paper name different sensors.
- With the inner pair now doing the tracking, the line geometry matters. If the
  track line is narrow enough to pass *between* the two inner sensors, the
  centred state is both-white, and the old code would have read that as
  `ERROR:LINE_LOST` within 2.5 seconds. A new switch, `TRACK_LINE_WIDE`, covers
  both geometries. Check it before the first run — `DOCUMENTATION.md` section 3
  explains the ten-minute test.

**2. Checkpoint counting has no absolute reference.** Position is tracked by
counting lines, so one missed or double-counted line leaves the robot's idea of
where it is permanently wrong until you power-cycle it. Add a distinct marker at
pot 1 — a wider line, or a simple limit switch at the end of the rail — and have
`RETURN` drive until it hits that marker rather than counting backwards. Until
then, treat `RETURN` as an approximate command and re-home by hand if the count
drifts.

**3. Watering duration is not watering volume.** The system controls seconds of
pump time, not millilitres. Pump output changes with battery voltage and with
the water level in the reservoir, so 8 seconds today is not 8 seconds tomorrow.
For the paper this is already handled by the SIL framing, but if you later add a
YF-S401 flow sensor you could close the loop on actual volume, which is a much
stronger claim.

**23. The 2-minute cooldown is shared by all five pots, and you will see it on
the first sweep.** This came out of your question 3.

`cooldownElapsed()` compares against a single `lastPumpStop` timestamp. Water pot
1, drive to pot 2 about thirty seconds later, and pot 2 is refused — along with
pots 3, 4 and 5. In a full sweep, only the first pot that needs water gets any.
The dashboard will show `Pump cooldown active, both pumps held` for the rest,
which reads like a bug but is the parameter working as written.

Two defensible readings of the published 2-minute parameter:

- **Global.** The cooldown protects the pump from rapid duty cycling. One pump
  serves all five pots, so one shared timer is the literal reading. This is the
  default, `COOLDOWN_PER_POT 0`.
- **Per pot.** The cooldown protects each plant from being watered twice in
  quick succession. On a mobile robot serving five pots this is the agronomically
  sensible reading, and it is what makes a demo sweep actually work.
  `COOLDOWN_PER_POT 1`.

I have left the default at global because it matches the parameter as published
and changing a locked number is your call, not mine. My recommendation is to
switch to per-pot and describe it that way, because a sweep that waters one plant
out of five is hard to present. Either way, decide before the demo rather than
during it, and make sure whoever presents can explain the choice.

Note that pump duty cycling is still bounded under per-pot mode: the 10 s
maximum duration and the travel time between pots together keep the pump well
inside a safe duty cycle.

**27. Reverse line following is unstable, and that is a mounting problem rather
than a code bug.** This is your question 7, and the answer is longer than a yes
or no.

Driving forward, the sensor bar leads. It sees the error before the body reaches
it, and slowing the inner wheel pulls the nose back onto the line. Stable.

Driving in reverse, the sensor bar trails. Writing `y` for the sideways offset of
the sensor bar from the line, `psi` for the heading error, `u` for speed along
the heading and `L` for the distance from the wheel axis to the sensors:

```
y_sensor = y_body + L * psi
d(y_body)/dt = u * psi
d(psi)/dt    = omega
```

With a proportional law `omega = -k * y_sensor`, the closed loop's determinant is
`u * k`. Forward, `u` is positive and the loop converges. Reverse, `u` is
negative, the determinant flips sign, and the system becomes a saddle: it
diverges. Inverting the sign does not rescue it — that makes the trace positive
instead. It is the same reason reversing a trailer is hard, and it is a property
of where the sensors are mounted.

So to answer the question directly: **the original code was not wrong, but no
sign is right.** What was there applied the forward correction with a negated
magnitude, which is the more direct of the two options and holds over short
distances because the `L * omega` term acts fast. Over several pots the heading
error accumulates and the robot leaves the track.

What is now in the code:

- `SPEED_REVERSE` dropped from 140 to 120, so less distance passes per unit of
  accumulating heading error.
- `SPEED_TURN_INNER_REV` (95) corrects more gently in reverse than the forward
  value (70) does.
- `REVERSE_STEER_INVERT` lets you test both signs empirically. Default `0`,
  matching the original behaviour.
- The full derivation sits in section 15 of `AquaM_ESP32_B.ino`, so whoever
  bench-tests it can read the reasoning next to the code.

**How to test it.** Send `TARGET:5`, then `TARGET:1`, and watch the return run.
Measure how far it drifts over one pot spacing, then over four. Try both values
of the switch. Expect one-pot reverse moves to work and four-pot reverse moves to
wander.

**The real fix** is a second, rear-facing pair of TCRT5000 sensors, so whichever
end is leading is the one steering. Two ADC1 pins are still free on ESP32 B. If
you have the parts and a spare afternoon, this is the highest-value hardware
change on this whole list.

**Until then**, drive forward wherever possible: a sweep of 1 → 2 → 3 → 4 → 5
followed by a single reverse run home is much more reliable than hopping back and
forth between pots.

**29. A single dropped IR sample can cost you a whole checkpoint, and the
penalty is 150 ms rather than 5 ms.** Found in Phase 3 by Monte Carlo over
`checkpointReached()` — see `sil/SIL_RESULTS.md` §3 for the full table.

`checkpointReached()` requires both checkpoint sensors to read black
*continuously* for `CHECKPOINT_DEBOUNCE_MS` (50 ms, a locked parameter). One
noisy sample in the middle of a crossing does three things at once: it clears
`cpActive`, it stamps `cpClearedAt = now`, and it resets `cpCounted`. The next
count then needs 50 ms of fresh continuous black **and** `CHECKPOINT_CLEAR_MS`
(150 ms) to have elapsed since that stamp. On a short crossing the line is gone
before either condition can be met.

Simulated miscount rate over one crossing, 40 runs per level, excluding the
40 ms crossing which is under the debounce and must be missed by design:

| IR sample dropout | miscounts |
|-------------------|-----------|
| 0 % | 0 % |
| 5 % | 33 % (11 missed, 2 double-counted) |
| 15 % | 83 % |
| 30 % | 100 % |

Why it matters: item 2 says position has no absolute reference, so one missed
line desynchronises the robot permanently until a power cycle. Combined, a
handful of dusty samples during one crossing puts the robot at the wrong pot for
the rest of the run — and it will keep watering confidently at the wrong plant.
Bright stage lighting on IR sensors is on the demo-day risk list for exactly
this reason.

**Nothing has been changed.** Three reasons to decide as a team rather than
have me pick:

- The 50 ms debounce is a locked parameter from the paper. It is *not* the part
  I would change, but any discussion of this lands next to it.
- `CHECKPOINT_CLEAR_MS` (150 ms) is **not** locked, and the cheap fix is to stop
  stamping `cpClearedAt` on a momentary dropout — only stamp it once the sensors
  have been continuously clear for some interval. That is a behaviour change, so
  it is your call, not mine.
- The alternative fix is physical and may be better: a wider checkpoint line.
  The debounce needs 50 ms of continuous black, which at carriage speed *v* is
  0.05·*v* metres. Measure *v* on the bench and make the line at least that wide
  with margin.

Severity: high · Likelihood on demo day: medium · Effort to fix: minutes for the
timing change, or a strip of tape for the physical one.

**4. BTS7960 wired natively instead of PWM+DIR.** A BTS7960 expects two PWM
inputs (RPWM and LPWM), not one PWM and one direction bit. The original pin
table would have needed extra logic hardware. `motorWrite()` now drives both
pins with PWM on the same four GPIOs — forward puts PWM on A and 0 on B, reverse
does the opposite, and 0/0 brakes. Tie R_EN and L_EN to +5 V. Set
`MOTOR_DRIVER_DUAL_PWM 0` if you switch to an L298N.

**5. Network calls can no longer stretch a watering cycle.** A Gemini call can
block for 15 seconds. If that happened while a pump was running, the pump would
overrun. The mission state machine now issues network calls only in `ST_IDLE`
and `ST_DECIDE`, where both pumps are off by construction, and
`enforceActuatorSafety()` runs on every loop iteration as an independent
watchdog that can only ever turn pumps off.

**6. Checkpoint detection is edge-triggered.** A 50 ms debounce alone would
count a thick line several times as the robot rolls across it. The sensors must
now be clear for 150 ms before another checkpoint can register.

**7. Line-loss and move timeouts.** If the robot leaves the track it used to
keep driving. It now sweeps back toward the last known edge, and if the line
stays lost for 2.5 s it stops and reports `ERROR:LINE_LOST`. A whole move also
times out after 45 s.

**8. Solar tracker deadband floor.** A pure 5 % tolerance goes to almost zero in
darkness, so the servo would hunt all night. The tolerance now has a floor of
30 ADC counts.

**9. Fertiliser pump has its own ceiling.** The spec only capped the water pump.
Fertiliser is now clamped to 5 s, and the firmware re-clamps whatever the AI
returns — the model cannot talk the robot into a longer dose.

**10. Probe settle time.** The soil reading is taken 2 s after `SENSOR_READY`,
not immediately, so the capacitive probe has time to stabilise in the soil.

**11. ArduinoJson 6 and 7 both compile.** A `JSON_DOC` macro picks the right
document type, so you are not locked to one library version.

**12. Arduino-ESP32 core 2.x and 3.x both compile.** The LEDC API changed
between them; `pwmSetup()` and `pwmWrite()` wrap the difference.

**24. Weather parsing no longer depends on the degree symbol.** Your question 4.
`parseNumber()` now keeps only digits, `-`, `+` and `.`, dropping everything
else before `toFloat()`. The old code stripped three specific substrings, which
would have failed if wttr.in returned the degree sign differently, omitted it, or
added a space. The `valid` flag now also depends on the temperature parsing
succeeding, so a half-parsed response cannot reach the AI prompt looking healthy.

**25. Sensor faults are now two named flags.** Your question 5. The old
one-liner was correct but read like an accident. It is now `dhtFault` and
`soilFault`, each with its own comment, and both are uploaded to Firebase so the
dashboard can name the sensor instead of showing a single unexplained light.

The soil probe really is only judged during a mission, and that is intentional:
the probe rides on the arm, so between missions it hangs in air and always reads
out of range. Judging it there would leave the red LED on permanently. The window
is now expressed as `probeIsPlanted()`, which is true from `ST_SETTLE` to
`ST_IRRIGATE_OFF` — the exact span where the probe is in soil. Note this is
narrower than the old `mission != ST_IDLE`, which also covered driving and arm
movement, when the probe is still in the air.

The pH probe is deliberately in neither flag. An out-of-range pH is handled by
not sending it to the AI. It does not stop irrigation and does not deserve an
error light.

**18. Fertiliser now shares the water cooldown.** This was your question 3, and
the answer was that the old behaviour was not intentional — it was a gap. Both
pumps are now held when the cooldown has not elapsed, and the fertiliser is
marked `fertilizer_deferred` rather than cancelled, so it can be applied on the
next visit.

The reasoning: liquid fertiliser is still liquid going into the same pot. Letting
5 seconds of it through while the firmware has just decided the medium was too
recently wetted defeats the purpose of the cooldown. The fertiliser pump has no
cooldown of its own, so without this guard nothing spaced fertiliser out at all.

Same treatment for an invalid soil probe: it now stops fertiliser as well as
water. A nutrient dose chosen from a reading we do not trust is worse than no
dose.

One thing to check against the paper: if the paper describes fertilisation as
independent of the pump cooldown, the text and the firmware now differ. Worth a
five-minute read of that paragraph.

**22. Hardware watchdog — now implemented on both boards.** `esp_task_wdt` adds
no measurable flash, since the driver is already linked into the Arduino core.
ESP32 A uses a 30 s timeout, ESP32 B uses 8 s.

The asymmetry is deliberate and worth understanding before you change it: a
single loop iteration on ESP32 A can legitimately block for 15 seconds inside
the Gemini POST. A short timeout would reset the board every time the API was
slow, which would be worse than no watchdog at all. ESP32 B never makes a
blocking call, so it can afford to be strict.

One hardware note that goes with it. A watchdog reset puts every GPIO into
high-impedance. With an active-LOW relay module, a floating input can let a pump
twitch on for the length of the reset. Fit 10 kΩ pull-ups to 3.3 V on GPIO 26 and
GPIO 27 so the relays are held off through the reset. Without them the watchdog
slightly increases the risk it is there to remove.

**13. All analogue pins are on ADC1.** ADC2 is unusable while Wi-Fi is on. Every
analogue pin in both sketches is an ADC1 pin, which is why the given pin map
works.

**30. The five bench-test switches could not actually be switched from a build
command, so "both branches compile" had never been tested.** Found in Phase 1
when two matrix rows that should have differed came out byte-identical.

All five were plain `#define`s:

```c
#define CHECKPOINT_USES_INNER_SENSORS 0
```

A `#define` in the file always wins over a `-D` on the command line — the
compiler takes the later definition and emits a `"... redefined"` warning. So
every attempt to build the alternate branch silently rebuilt the default one.
Each of the four ESP32 B switch rows and the ESP32 A `COOLDOWN_PER_POT=1` row
reported PASS while compiling exactly the same code as its default.

Each switch is now wrapped:

```c
#ifndef CHECKPOINT_USES_INNER_SENSORS
#define CHECKPOINT_USES_INNER_SENSORS 0
#endif
```

**Every published default is unchanged** (`0`, `0`, `1`, `0`, `1`). With no `-D`
on the command line the preprocessor output is identical to before, so this is
not a change to anyone's bench-test decision — it only makes the switches
reachable from `tools/build_matrix.sh`. All eleven matrix rows now pass and the
variant rows differ in size from their defaults, which is the evidence they are
genuinely being compiled.

Severity: medium · Likelihood on demo day: n/a · Effort to fix: done.

**14. Boot strapping pins.** GPIO 12 (ESP32 A servo, ESP32 B motor) and GPIO 15
(ESP32 B motor) are strapping pins. If GPIO 12 is pulled high at boot the board
may pick the wrong flash voltage and fail to start. Add a 10 kΩ pull-down on
GPIO 12 and a 10 kΩ pull-up on GPIO 15, or power the drivers only after the
ESP32s have booted. This is a real failure mode that will look like a dead board.

**15. Secrets are in the firmware.** The Gemini API key and the Firebase
database secret are compiled into `AquaM_ESP32_A.ino`. Anyone who reads the
flash has both. For a school demo this is acceptable; do not push the file to a
public repository with real keys in it, and rotate the Gemini key afterwards.

**16. TLS certificates are not checked.** Both HTTPS calls use `setInsecure()`,
which encrypts the traffic but does not verify who is on the other end. Pinning
the Google root certificate is the proper fix if you have flash to spare.

**17. Firebase rules.** The open read/write rules in the documentation are for
development. Before showing the dashboard publicly, restrict writes to
`/device/esp32_a/command` and make everything else read-only, or anyone with the
URL can drive your robot.

**19. One probe for five pots.** The same moisture and pH probe goes into every
pot, so soil carries over between plants. Nothing in software fixes this — just
be ready for the question, and mention wiping the probe in your demo routine.

**20. pH calibration values are placeholders.** 2200 and 1500 are examples. Put
the probe in pH 4.0 and pH 9.0 buffer solutions, note the actual ADC readings,
and replace `PH_ADC_AT_4` and `PH_ADC_AT_9`. Until you do, treat every pH number
on the dashboard as decorative.

**21. Dashboard commands land within 3 seconds.** ESP32 A polls the command node
every 3 s and only while idle. That is fine for a demo but will feel laggy if a
judge expects instant response. A Firebase stream (`Firebase.beginStream`) would
make it immediate.

**28. Relay pull-ups (the hardware half of item 22).** A watchdog reset puts
every GPIO into high impedance. With active-LOW relays a floating input can let a
pump twitch on for the length of the reset. Fit 10 kΩ pull-ups to 3.3 V on
GPIO 26 and GPIO 27 before you rely on the watchdog.

**31. Reverse drift is now quantified, and the model disagrees with the switch
default over long runs.** Phase 3, `sil/SIL_RESULTS.md` §4.

Item 27 argues reverse line following diverges for either sign of
`REVERSE_STEER_INVERT`. A kinematic simulation of that argument, using the
firmware's own `SPEED_REVERSE` and `SPEED_TURN_INNER_REV`, agrees — the offset
grows with distance in both cases:

| `REVERSE_STEER_INVERT` | 1 pot | 2 pots | 4 pots |
|------------------------|-------|--------|--------|
| 0 (default) | 0.054 m | 0.294 m | 1.445 m |
| 1 | 0.102 m | 0.150 m | 0.338 m |

Both diverge, so item 27 stands. But they diverge at different rates: the
default is better over one pot spacing and roughly four times worse over four.

**Do not change the default on the strength of this.** It is a 5 ms bang-bang
integration with assumed geometry — sensor bar 0.12 m ahead of the axis, 0.15 m
wheel track, 0.0016 m/s per PWM unit — and no mass, slip or friction. The
assumptions are listed in `SIL_RESULTS.md` so you can vary them. What it is good
for is telling you what to look for on the bench: run `TARGET:5` then `TARGET:1`
with each value of the switch and measure the offset after one pot and after
four. If `INVERT=1` really does hold better over long reverse runs, that is worth
knowing before the demo; if it does not, the model was wrong and the default
stays.

Severity: low · Likelihood on demo day: medium (only matters if you reverse more
than one pot spacing) · Effort to fix: needs hardware.

**32. `robotCurrentPot` is assigned straight from the UART line with no
validation.** Found in Phase 3 by fuzzing the RX path, `sil/harness_a.cpp`
invariant 6.

`handleUartLine()` does:

```c
robotCurrentPot = line.substring(8).toInt();
```

Feed it `ARRIVED:-1` or `ARRIVED:9` and `robotCurrentPot` becomes −1 or 9. Under
the fuzz it reached the range −1..9.

**This is cosmetic, and the reason it is cosmetic is worth reading**, because it
is the code being defensive in the right places. Every use that could hurt is
already bounded:

- `setWaterPump()` range-checks before writing the per-pot cooldown array:
  `if (p >= POT_MIN_INDEX && p <= POT_COUNT) lastPumpStopPot[p] = ...`
- `activePot()` clamps with `constrain(p, POT_MIN_INDEX, POT_COUNT)`

So the out-of-range value never indexes `lastPumpStopPot[6]` and never selects a
wrong cooldown slot. The SIL harness asserts this directly: across 18 malformed
lines delivered in all 13 mission states, `activePot()` never left 1..5.

What does leak through is display: the LCD prints `P-1`, the dashboard's
`current_pot` shows −1, and the AI prompt can carry a nonsense pot number when
no mission is active. A judge looking at the dashboard would see it.

The fix is one line in `handleUartLine()` — clamp on assignment, or ignore a
line whose pot number is outside 1..`POT_COUNT`. It was left alone because it
changes behaviour in a path that currently cannot be reached from ESP32 B, which
constrains its own pot index before replying. It becomes reachable if the UART
line is ever corrupted by noise, which on a two-board robot with motor drivers is
not far-fetched.

Severity: low · Likelihood on demo day: low · Effort to fix: minutes.

# Aqua-M V2 — SIL (software-in-the-loop) results

**These are simulation results. No hardware measurement is included anywhere in
this document.** The hardware had not arrived when this was written. Every
number below was produced by compiling the shipping firmware on a host PC and
driving it with synthetic inputs and a virtual clock. Nothing here says what the
robot does; it says what the code does when given those inputs.

Reproduce everything with one command:

```bash
bash sil/build.sh
```

- Harness: `sil/harness_a.cpp`, `sil/harness_b.cpp`, stubs in `sil/stubs/`
- Compiler: g++ 16.1.0 (WinLibs MinGW-w64, UCRT), `-std=c++17 -O1`
- ArduinoJson 7.4.3 — the real library, not a stub, because its behaviour is
  part of what is under test
- Date of run: 2026-09-08
- Random seed: 20260908 (checkpoint Monte Carlo), 7 (command fuzzing)

The sketches are `#include`d directly by the harness, so these results describe
the code that ships. A copied-out version would drift within a week.

---

## 1. Coverage

| Harness build | Checks | Result |
|---------------|--------|--------|
| ESP32 A | 87 | all pass |
| ESP32 B, `TRACK_LINE_WIDE=1` (default) | 15 | all pass |
| ESP32 B, `TRACK_LINE_WIDE=0` | 14 | all pass |
| ESP32 B, `REVERSE_STEER_INVERT=1` | 15 | all pass |
| **Total** | **131** | **all pass** |

Invariants from brief §7.4–7.5, by number:

| # | Invariant | State |
|---|-----------|-------|
| 1 | No network call while a pump runs | tested, holds |
| 2 | Both relays off at reset and after every abort | tested, holds |
| 3 | Durations clamped whatever the AI returns | tested, holds |
| 4 | Cooldown holds **both** pumps, sets `fertilizer_deferred` | tested, holds |
| 5 | Fertiliser never applied from the local path | tested, holds |
| 6 | Every wait state exits (UART fuzzing) | **not yet covered** |
| 7 | `parseNumber()` survives every wttr.in shape | **not yet covered** |
| 8 | `probeIsPlanted()` true exactly ST_SETTLE..ST_IRRIGATE_OFF | **not yet covered** |
| 9 | Rollover at `0xFFFFFFFF` | tested, holds |
| 10 | One checkpoint counted exactly once | tested — **see §3, it is conditional** |
| 11 | `currentPot` stays 1..5 under any command sequence | tested, holds |
| 12 | Motors reach zero on STOP, error, line loss | tested, holds |
| 13 | Arm sequencer terminates at a defined pose | tested, holds |
| 14 | Both `TRACK_LINE_WIDE` and `REVERSE_STEER_INVERT` branches exercised | tested, holds |
| 15 | Reverse drift quantified | modelled — **see §4** |

---

## 2. Known-answer table (SIL)

The harness was validated against cases whose answer is arithmetic before any
scenario work, as brief §7.3 requires. All 13 agree with the firmware.

| Input | Expected | Result |
|-------|----------|--------|
| soil ADC 3200 | 0 % | pass |
| soil ADC 1075 | 100 % | pass |
| soil ADC 2137 | ≈50 % | pass |
| soil ADC 500 | invalid → 50 %, `soilValid` false | pass |
| soil ADC 4000 | invalid → 50 %, `soilValid` false | pass |
| pH ADC 2200 | 4.00 | pass |
| pH ADC 1500 | 9.00 | pass |
| pH ADC 1850 | ≈6.50 | pass |
| pH ADC 2500 | invalid, `phValid` false | pass |
| soil 25 %, 30 °C | 8000 ms | pass |
| soil 45 %, 30 °C | 4000 ms | pass |
| soil 45 %, 38 °C | 6000 ms | pass |
| soil 70 %, 40 °C | 0 ms | pass |

### Hostile AI replies (SIL)

Invariant 3 was driven with all 13 hostile responses the brief lists: a
999999 ms duration, negatives, `null`, a string where an int belongs, a float,
missing keys, JSON inside code fences, prose before the JSON, a truncated body,
an empty body, HTTP 429, HTTP 500, and a 20-second stall. In every case the
firmware clamped water to ≤10 000 ms and fertiliser to ≤5 000 ms, and never
commanded a pump for zero milliseconds.

### Hostile dashboard commands (SIL)

`target_pot` was written as 99, −1, 0, 6 and 2147483647, and `action` as an
injection-shaped string. In every case the pot index stayed inside 1..5 or the
command was ignored, and an unknown action left the mission idle.

---

## 3. Checkpoint counting under IR noise (SIL Monte Carlo)

**Method.** One checkpoint line is crossed once. Sensors are sampled every 5 ms:
400 ms clear on approach, `crossing ms` on black, 400 ms clear on departure. A
*glitch level* of *g* % means each sample is independently flipped with
probability *g*. 10 runs per cell, seed 20260908. This models IR dropout from
dust, ambient light and reflectivity variation — it is **not** a measurement of
the TCRT5000s, which have not been wired up.

| glitch % | crossing ms | miscounts /10 | missed | double-counted |
|----------|-------------|---------------|--------|----------------|
| 0 | 40 | 10 | 10 | 0 |
| 0 | 60 | 0 | 0 | 0 |
| 0 | 100 | 0 | 0 | 0 |
| 0 | 200 | 0 | 0 | 0 |
| 0 | 400 | 0 | 0 | 0 |
| 5 | 40 | 10 | 10 | 0 |
| 5 | 60 | 2 | 2 | 0 |
| 5 | 100 | 4 | 4 | 0 |
| 5 | 200 | 4 | 4 | 0 |
| 5 | 400 | 3 | 1 | 2 |
| 15 | 40 | 10 | 10 | 0 |
| 15 | 60 | 8 | 8 | 0 |
| 15 | 100 | 8 | 8 | 0 |
| 15 | 200 | 10 | 10 | 0 |
| 15 | 400 | 7 | 7 | 0 |
| 30 | 40 | 10 | 10 | 0 |
| 30 | 60 | 10 | 10 | 0 |
| 30 | 100 | 10 | 10 | 0 |
| 30 | 200 | 10 | 10 | 0 |
| 30 | 400 | 10 | 10 | 0 |

Excluding the 40 ms row, which is shorter than the 50 ms debounce and must be
missed by design:

| glitch % | miscounts | of 40 runs |
|----------|-----------|------------|
| 0 | 0 | 0 % |
| 5 | 13 (11 missed, 2 double) | 33 % |
| 15 | 33 | 83 % |
| 30 | 40 | 100 % |

**Reading.** With a clean sensor the counter is exact at every crossing the
debounce can see — that part of the firmware is correct. The sensitivity comes
from how the debounce is written: a single dropped sample clears `cpActive`,
stamps `cpClearedAt`, and then blocks counting for a further
`CHECKPOINT_CLEAR_MS` (150 ms) on top of restarting the 50 ms window. On a short
crossing there is no time left to recover, so the line is missed. This is
recorded as **RECOMMENDATIONS item 29**.

The two double-counts at 5 % / 400 ms matter as much as the misses: a spurious
black sample after departure, followed by a real re-acquisition, can add a
count. Position then runs *ahead* of reality rather than behind.

**Minimum line width.** The debounce needs the sensors black for a continuous
50 ms. At a carriage speed of *v* m/s that is 0.05·*v* metres of line. Measure
*v* on the bench and make the checkpoint line at least that wide with margin —
this document deliberately does not guess *v*.

---

## 4. Reverse drift (SIL kinematic model)

**This is a model, not a measurement, and it is a coarse one.** It integrates
the kinematics `ẏ = u·ψ`, `ψ̇ = ω` with the sensor offset `y_sensor = y + L·ψ`
and the firmware's own bang-bang correction, at 5 ms steps. Mass, wheel slip,
rail friction, motor dynamics and sensor quantisation are **not** modelled.

Assumptions, stated so they can be varied: sensor bar `L` = 0.12 m ahead of the
wheel axis, wheel track 0.15 m, pot spacing 0.30 m, and 0.0016 m/s of carriage
speed per PWM unit. `SPEED_REVERSE` = 120 and `SPEED_TURN_INNER_REV` = 95 are
read from the firmware. Initial condition: 5 mm off the line, aligned.

| `REVERSE_STEER_INVERT` | 1 pot | 2 pots | 4 pots |
|------------------------|-------|--------|--------|
| 0 (default) | 0.054 m | 0.294 m | 1.445 m |
| 1 | 0.102 m | 0.150 m | 0.338 m |

**Reading.** Both signs diverge — the offset grows with distance in both rows,
which is what RECOMMENDATIONS item 27 predicts and the reason it calls this a
mounting problem rather than a code bug. Neither sign is stable.

The rows differ in *how fast* they diverge. In this model `INVERT=0` is better
over one pot spacing and much worse over four; `INVERT=1` starts worse and grows
more slowly. If that ordering survives contact with the real robot, the switch
default is worth revisiting — but a 5 ms bang-bang model with guessed geometry
is not evidence for changing a default, so nothing was changed. It is a
prediction to test on the bench, recorded as **RECOMMENDATIONS item 31**.

---

## 5. What this does not tell you

Stated plainly, because the distinction is the whole point of labelling this
SIL:

- Nothing here has been on hardware. No pump has run, no probe has entered
  soil, no line has been crossed.
- Timing is virtual. A 15 s AI call costs 15 s of simulated time, not real
  network time, and says nothing about what the venue Wi-Fi will do.
- Sensor models are synthetic. The IR glitch levels are plausible shapes for
  dropout, not measured noise from the TCRT5000s on this robot.
- Servo jitter, current draw, brown-outs, ground loops and EMI are outside the
  model entirely.
- The reverse-drift figures are the output of a coarse kinematic integration
  with assumed geometry, not a measured trajectory.

The SIL harness rules out whole classes of logic bug. It cannot substitute for
the bench tests in `DOCUMENTATION.md` section 3.

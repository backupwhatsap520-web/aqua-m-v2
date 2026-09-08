# Aqua-M V2 — verification run log

Append-only. One block per iteration, including hypotheses that turned out
wrong. Never rewrite earlier entries.

Branch: `verify/build-pass`

---

## Iteration 0 — 2026-09-08 14:37

**Phase:** 0 (setup)

**Environment as found**

| Item | State |
|------|-------|
| Host | Windows 11 Pro 26200, git bash + PowerShell |
| arduino-cli | 1.2.0, bundled inside Arduino IDE 2 at `%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe` |
| Cores installed | `esp32:esp32` 3.3.11, `arduino:esp32` 2.0.18-arduino.5, `arduino:avr` 1.8.6 |
| Node | v24.19.0, npm 11.17.0 |
| Website | **absent** — the `website/` tree the brief describes does not exist in this repo |

The brief's §3.1 install script was not needed: arduino-cli ships inside the
Arduino IDE already on this machine, and the current `esp32:esp32` core is
already present. Core `esp32:esp32@2.0.17` is **not** installed yet and is
required by the build matrix.

Note `arduino:esp32` 2.0.18-arduino.5 is Arduino's own ESP32 core, a different
package from Espressif's `esp32:esp32`. It is not a substitute for 2.0.17 in the
matrix.

**Change:** `.gitignore` rewritten — added `*.local` and `sil/out/` as §2.5
requires, and converted its comments to English to match the repo convention
stated in §11.

**Result:** branch `verify/build-pass` created off `main`. No firmware touched.

---

## Iteration 1 — 2026-09-08 15:02

**Phase:** 1 (firmware build)
**Target:** ESP32 A, core `esp32:esp32` 3.3.11, ArduinoJson 7.4.3, switch defaults

**Hypothesis:** the brief warns this code has never been compiled and to expect
real errors, so the first build will fail — most likely on the `esp_task_wdt`
API split (§5.2 item 1) or the ArduinoJson 6/7 `JSON_DOC` macro (item 4).

**Change:** none. Build only.

**Result:** **the hypothesis was wrong — it compiled clean, zero errors, first
attempt.** Both predicted failure points are correct as written:

- A §17b initialises `esp_task_wdt_config_t` with designated initialisers in
  declaration order (`timeout_ms`, `idle_core_mask`, `trigger_panic`), which is
  what IDF 5.x expects, behind an `ESP_ARDUINO_VERSION_MAJOR >= 3` guard.
- The `JSON_DOC` macro resolves to `JsonDocument` on ArduinoJson 7 and compiles.

| Metric | Value | Budget |
|--------|-------|--------|
| Flash | 1 401 466 B | 44 % of 3 145 728 (`huge_app`) |
| RAM (globals) | 53 536 B | 16 % of 327 680 |

Headroom is comfortable on both.

**Warnings: 8 total, 7 from libraries, 1 from the sketch.**

Library warnings (not our code, not actionable here): ESP32Servo 3.2.1 —
unused `val`, unused `ret`, unused `TAG` (×2), and `B00000100` / `B00000001`
binary-constant warnings.

Sketch warning, A line 918 in `taskLcd()`:

```
'%s' directive output may be truncated writing up to 14 bytes into a region
of size between 0 and 8 [-Wformat-truncation=]
snprintf(l1, sizeof(l1), "%s P%d %s %s", md, robotCurrentPot, pm,
         decision.source.c_str());
```

Triaged as a **false positive, no change made.** `decision.source` only ever
holds `"NONE"`, `"AI"` or `"LOCAL"` (lines 205, 667, 700), so the real worst
case is 3 + 2 + 2 + 1 + 1 + 1 + 5 = 15 bytes plus NUL = 16, inside the 17-byte
buffer. The compiler cannot prove either bound, so it assumes an 11-digit `%d`
and a 14-byte `String`. `snprintf` truncates safely regardless, so even the
impossible case cannot overflow. Per §5.3 the code is not changed to satisfy a
compiler when the logic is correct.

**Commit:** pending (matrix still running)

---

## Iteration 2 — 2026-09-08 15:24

**Phase:** 1 (firmware build)
**Failing:** not a compile failure — a **false pass**. All four ESP32 B switch
variants and the ESP32 A `COOLDOWN_PER_POT=1` row reported PASS while compiling
the *default* branch, so §2.3 ("both branches of every switch must compile") was
not actually being tested.

**How it surfaced:** two signals agreed. Flash size was byte-identical between
`A_core3_aj7_defaults` and `A_core3_aj7_cooldownperpot` (both 1 401 466), and
each switch row carried exactly one extra sketch warning at the line of its own
`#define`. Decoding the JSON log gave the reason:

```
AquaM_ESP32_B.ino:38:9: warning: "CHECKPOINT_USES_INNER_SENSORS" redefined
   38 | #define CHECKPOINT_USES_INNER_SENSORS 0
<command-line>: note: this is the location of the previous definition
```

**Hypothesis:** the five bench-test switches are plain `#define X <v>` with no
`#ifndef` guard, so the in-file definition always overrides the `-D` supplied
through `--build-property compiler.cpp.extra_flags`. The override method the
brief documents in §3.3 cannot work against an unguarded macro.

**Change:** wrapped all five switches in `#ifndef` / `#endif` — A §0
`COOLDOWN_PER_POT`, B §1a–1d `CHECKPOINT_USES_INNER_SENSORS`,
`TRACK_LINE_WIDE`, `REVERSE_STEER_INVERT`, `MOTOR_DRIVER_DUAL_PWM`. Each keeps
its published default (`0`, `0`, `1`, `0`, `1`), so this is not a §2.3 default
flip: with no `-D` on the command line the preprocessor output is identical to
before. It only makes the switches overridable, which is what §3.3 assumes.

**Result:** pending re-run of the matrix.

**Note for the team:** this also means any past claim that "both branches
compile" — if one was made before this run — was not actually tested. Nothing in
the repo makes such a claim, so nothing needs correcting; recorded here so the
gap is visible.

---

## Iteration 3 — 2026-09-08 15:41

**Phase:** 1 (firmware build)
**Target:** §5.2 item 8 — "ESP32Servo timers vs LEDC channels. Verify there is no
clash on either core. A clash shows up at runtime as servo jitter, not as a
compile error, so reason about it explicitly."

**Method:** read the installed ESP32Servo 3.2.1 source rather than reasoning
from memory. Two functions settle it, both in `src/ESP32PWM.cpp`:

```cpp
void ESP32PWM::allocateTimer(int timerNumber){       // line 32
  if(ESP32PWM::explicateAllocationMode==false){
    ESP32PWM::explicateAllocationMode=true;
    for(int i=0;i<4;i++) ESP32PWM::timerCount[i]=4;  // mark ALL timers full
  }
  ESP32PWM::timerCount[timerNumber]=0;               // then free just this one
}

int ESP32PWM::timerAndIndexToChannel(int timerNum, int index) {   // line 98
  for (int j = 0; j < NUM_PWM; j++)
    if (((j / 2) % 4) == timerNum) { ... return j; }
}
```

So `allocateTimer(n)` is a whitelist, not a reservation: the first call marks
every timer as full (`timerCount = 4`, and the allocator skips any timer whose
count is not `< 4`), then frees only the named one. Channel `j` belongs to timer
`(j / 2) % 4`.

**Resulting allocation on ESP32 B** (`NUM_PWM` = 16 on the classic ESP32):

| Consumer | `allocateTimer` | Timers | LEDC channels |
|----------|-----------------|--------|---------------|
| Motors, 5 kHz, 8-bit | n/a — channels named directly in §3 | 0, 1 | 8, 9, 10, 11 |
| Arm servos ×4, 50 Hz | 2 and 3 | 2, 3 | 4, 5, 6, 7 |

Channels 8–11 map to timers `(8/2)%4 = 0`, `(9/2)%4 = 0`, `(10/2)%4 = 1`,
`(11/2)%4 = 1`. Timers 2 and 3 map to channels 4, 5 and 6, 7. **Disjoint in both
channel and timer.** On core 2.x they are also in different LEDC speed groups
(`group = chan / 8`), so the separation is stronger there, not weaker.

**ESP32 A**: `allocateTimer(0)` for the single solar servo, and A drives no other
PWM — relays and LEDs are plain digital, the LCD is I²C. No contention possible.

**Result:** **no clash on either core.** The allocation as written is correct.
No change made. Recorded here because §5.2 item 8 asks for the reasoning to be
explicit, and because a future edit that adds a PWM consumer on B must avoid
channels 4–11.

**Caveat, stated honestly:** this is a static reading of the allocator, not a
hardware measurement. It rules out the *allocation* clash the brief asks about.
It cannot rule out jitter from other causes — servo current draw, shared ground,
or LEDC frequency drift — which need a board.

---

## Iteration 4 — 2026-09-08 15:58

**Phase:** 1 (firmware build)
**Target:** re-run the full §5.1 matrix now that the switches are `#ifndef`-guarded,
and add the core 2.0.17 and ArduinoJson 6.x rows.

**Environment added:** `esp32:esp32@2.0.17` installed into a *sandbox* data
directory (`~/.aquam-build/data`) rather than the Arduino IDE's own, because
arduino-cli keeps one version of a core per data directory and the IDE's copy
must stay at 3.3.11. ArduinoJson 6.21.5 likewise lives in a second sketchbook
(`~/.aquam-build/user-aj6`). `tools/build_matrix.sh` selects the pair per row.

**Result: 11 of 11 pass.**

| Combination | Result | Flash (B) | RAM (B) | Warnings | of which sketch |
|-------------|--------|-----------|---------|----------|-----------------|
| `A_core2_aj6` | PASS | 1 256 161 | 50 596 | 4 | 0 |
| `A_core2_aj7` | PASS | 1 260 609 | 50 596 | 4 | 0 |
| `A_core3_aj6` | PASS | 1 397 834 | 53 536 | 8 | 1 |
| `A_core3_aj7` | PASS | 1 401 466 | 53 536 | 8 | 1 |
| `A_core3_aj7_cooldown` | PASS | 1 401 498 | 53 536 | 8 | 1 |
| `B_core2` | PASS | 286 625 | 22 204 | 4 | 0 |
| `B_core3` | PASS | 298 591 | 22 912 | 4 | 0 |
| `B_core3_cp_inner` | PASS | 298 591 | 22 912 | 4 | 0 |
| `B_core3_track_narrow` | PASS | 298 459 | 22 912 | 4 | 0 |
| `B_core3_rev_invert` | PASS | 298 599 | 22 912 | 4 | 0 |
| `B_core3_single_pwm` | PASS | 300 399 | 22 912 | 4 | 0 |

**Evidence the guard fix worked:** the switch rows now differ in size from their
defaults — `track_narrow` −132 B, `rev_invert` +8 B, `single_pwm` +1 808 B,
`cooldown` +32 B — where before every one was byte-identical. No `redefined`
warning remains in any log.

`cp_inner` is still byte-identical to `B_core3`, and that one **is** expected:
§3 resolves the switch by swapping four pin constants
(`PIN_CP_LEFT`/`PIN_TRACK_LEFT` between the inner and outer pair), so the
instruction stream has the same shape and only the immediate pin values change.
Zero redefinition warnings confirm the `-D` was accepted this time.

**Warning triage across the matrix.** Sketch-level warnings are zero on core
2.0.17 and one on core 3.x — the `-Wformat-truncation` at A:918 already triaged
in Iteration 1 as a false positive. Its appearance only on 3.x is a GCC version
difference, not a code difference. Every remaining warning is inside ESP32Servo
3.2.1 (unused `val`, `ret`, `TAG`, and binary-constant `B00000100` /
`B00000001`), which is third-party and out of scope for §5.3's "fix minimally".

**Flash cost of the core generation:** ESP32 A grows ~145 kB moving from 2.0.17
to 3.3.11 (1 256 161 → 1 401 466). Both are far inside the 3 145 728 B budget,
so the choice is free from a size standpoint.

**Change:** `DOCUMENTATION.md` §10 extended with the verified toolchain table,
per-core flash/RAM figures, the reproduce command, and the OneDrive sketchbook
trap that blocked library installs on this machine.

**Commit:** next.

---

## Iteration 5 — 2026-09-08 16:47

**Phase:** 3 (SIL harness)
**Target:** stand up the harness for ESP32 A and get the §7.3 known-answer table
plus the priority invariants from §13 (1, 2, 3) running.

**Environment added:** g++ 16.1.0 (WinLibs MinGW-w64 UCRT). There was no host
C++ compiler on this machine — only the xtensa cross-compilers, which produce
ESP32 binaries that cannot run here.

**Built:** `sil/stubs/` (Arduino core, virtual clock, GPIO trace, injectable
sensors, fake Serial2, scriptable network with latency, Firebase, DHT, BH1750,
LCD, ESP32Servo, watchdog), `sil/harness_a.cpp`, `sil/build.sh`.

The sketch is `#include`d directly as §7.1 requires, so the harness cannot drift
away from what ships. ArduinoJson is the real library, not a stub.

**First compile: 13 errors, all in my stubs, none in the firmware.** Fixed by
promoting `constrain`/`min`/`max` to mixed-type templates (Arduino's are
macros), pulling `isnan` into the global namespace, adding `HTTP_CODE_OK`, the
`BH1750::Mode` enum, an `Arduino.h` shim, and `concat`/`read`/`readBytes` on the
stub `String` so ArduinoJson's `Writer<::String>` and `Reader<::String>`
specialisations bind instead of the stream fallback.

**Then: 83 passed, 1 failed — and the failure was mine, not the firmware's.**

**Hypothesis (wrong):** invariant 1 is violated — `Firebase.updateNode` was
reached with `waterPumpOn` true.

**Why it was wrong:** the test forced `waterPumpOn = true` while leaving
`mission = ST_IDLE`, which is a state the firmware never reaches. `loop()`
confines every network call behind `if (mission == ST_IDLE)`, and pumps only run
inside `ST_IRRIGATE_ON`/`ST_IRRIGATE_RUN`, with `ST_IRRIGATE_OFF` calling
`allPumpsOff()` before the machine returns to idle. I had constructed an
unreachable combination and then measured it.

**Change:** rewrote the test to drive a **real mission** end to end — the
harness plays ESP32 B over the fake UART, answering `TARGET:2` with
`MOVING`/`ARRIVED:2`, then `SENSOR_READY`, then `LIFTED` — with the AI reply
scripted to cost 12 s of virtual time and request the full 10 s of water. Added
two guards against a vacuous pass: the mission must reach `ST_IDLE`, and at
least one iteration must have had a pump actually running.

**Result: 87 passed, 0 failed.** Invariant 1 holds under a genuine mission with
a deliberately slow AI call. Also asserted structurally: a pump is never on
while `mission == ST_IDLE`, which is the reason the invariant holds rather than
a coincidence of timing.

**Covered so far:** §7.3 known-answer table in full (soil, pH, local rule);
invariant 1 (no network while pumping), 2 (safe reset and abort), 3 (duration
clamping against all 13 hostile AI replies the brief lists), 4 (cooldown holds
both pumps, and releases after 120 s), 5 (no local fertiliser, swept over a
21 x 8 soil/temperature grid), 9 (rollover across `0xFFFFFFFF`), and the §8.1
security lens on hostile dashboard commands (`target_pot` = 99, -1, 0, 6,
INT_MAX, and an injection-shaped action string).

**Not yet covered:** invariants 6, 7, 8 (UART fuzzing, `parseNumber`,
`probeIsPlanted`) and the whole of ESP32 B (10-15), including the Monte Carlo
checkpoint count and the reverse-drift model.

**Commit:** next.

---

## Iteration 6 — 2026-09-08 17:34

**Phase:** 3 (SIL harness) — ESP32 B
**Target:** §7.5 invariants 10-15.

**Added:** `sil/harness_b.cpp`, LEDC stubs in the prelude so motor duty can be
observed (invariant 12 needs proof the motors actually reach zero, and the
motors are driven through `ledcWrite`, which nothing was capturing).

**First run: 14 passed, 1 failed — my assertion was wrong, not the firmware.**

**Hypothesis (wrong):** a clean-IR crossing must be counted exactly once at
every crossing duration tested.

**Why it was wrong:** the shortest cell in the sweep is a 40 ms crossing, which
is *below* `CHECKPOINT_DEBOUNCE_MS` (50 ms). It must be missed — that is the
debounce doing its job. I had printed a note saying exactly that in the same
function while still asserting the opposite.

**Change:** the exactly-once assertion now applies to crossings the debounce can
see, and a separate assertion requires the 40 ms crossing to be missed on all
ten runs. If that ever starts counting, the debounce has broken.

**Result:** 15 passed, 0 failed. `build.sh` now also runs ESP32 B with
`TRACK_LINE_WIDE=0` and `REVERSE_STEER_INVERT=1`, satisfying invariant 14's
"exercised", not merely "compiled". Totals: **131 checks, all passing** across
four harness builds.

**Real finding — checkpoint counting under IR dropout.** Monte Carlo, 10 runs
per cell, 4 glitch levels x 5 crossing durations. With a clean sensor the count
is exact at every crossing the debounce can see. With dropout it degrades fast:
33 % miscounts at 5 % sample dropout, 83 % at 15 %, 100 % at 30 %.

The mechanism is in `checkpointReached()`: one bad sample clears `cpActive`,
stamps `cpClearedAt = now`, and resets `cpCounted`, so recovery needs a fresh
50 ms of continuous black *and* 150 ms since that stamp. On a short crossing
there is no time left. Two of the 5 %/400 ms runs double-counted rather than
missed, which is worse in one respect — position then runs ahead of reality.

Written up as **RECOMMENDATIONS item 29**, in section A rather than fixed,
because the cheap fix (stop stamping `cpClearedAt` on a momentary dropout) is a
behaviour change and it sits next to a locked parameter. §4.3 and §5.3 both make
that a stop-and-ask, not a decision for me.

**Reverse drift** modelled per invariant 15 and written up as item 31: both
switch values diverge, confirming item 27, but at different rates
(`INVERT=0`: 0.054 / 0.294 / 1.445 m over 1 / 2 / 4 pot spacings; `INVERT=1`:
0.102 / 0.150 / 0.338 m). Default not changed — a bang-bang model with assumed
geometry is not evidence for changing a bench-test default. Logged as something
to measure.

**Also written:** `sil/SIL_RESULTS.md`, labelled SIL in the title, in every table
heading and in a closing section that states plainly what the simulation cannot
tell you.

**Commit:** next.

---

## Iteration 7 — 2026-09-08 18:20

**Phase:** 3 (invariants 6, 7, 8) and 5 (bench-test sketch)

**Invariant 6 — every wait state exits, UART fuzzed.** Each of the four waiting
states (`ST_WAIT_ARRIVE`, `ST_WAIT_SENSOR`, `ST_WAIT_LIFTED`, `ST_SETTLE`) was
entered and then left in silence past its deadline; all four exit. 18 malformed
lines — bare `\n`, `\r\n`, `ARRIVED:` with no number, `ARRIVED:abc`,
`ARRIVED:-1`, `ARRIVED:9`, two statuses concatenated, two in one feed, a
400-byte line — were delivered in **all 13 mission states**. No hang. The
oversized line is discarded by the 96-byte overflow guard and the parser still
handles the next good line.

**One failure, and again the assertion was mine.** I had asserted
`robotCurrentPot` stays in an arbitrary 0..99 band. `ARRIVED:-1` sets it to −1,
because `handleUartLine()` assigns `line.substring(8).toInt()` with no
validation. Chasing where that value goes showed the firmware is defensive
exactly where it matters:

```c
if (p >= POT_MIN_INDEX && p <= POT_COUNT) lastPumpStopPot[p] = lastPumpStop;
int activePot() { return constrain(p, POT_MIN_INDEX, POT_COUNT); }
```

The per-pot cooldown array is never indexed out of bounds and no wrong slot is
selected. So the test now asserts the property that actually matters —
`activePot()` inside 1..`POT_COUNT` across every fuzz case — and reports the raw
range reached (−1..9) as a note rather than a failure. Written up as
**RECOMMENDATIONS item 32**, severity low, not fixed: it is unreachable from
ESP32 B, which constrains its own index before replying.

**Invariant 7 — `parseNumber`.** `+29`, `-3`, `29.5`, a UTF-8 degree sign, no
degree sign, an embedded space, empty, `N/A`, prose, whitespace: all correct.
Also driven end to end through `fetchWeather()`: an HTML error page is rejected
before `parseNumber` ever sees it, because the parser requires two `|`
separators — so a `404` in the page body cannot become a temperature. A failed
or stalled fetch leaves the last good value untouched.

**Invariant 8 — `probeIsPlanted`.** True in exactly `ST_SETTLE`..
`ST_IRRIGATE_OFF` and false in the other eight states. With the probe reading
open-circuit (4095) in every non-planted state, `soilFault` never latches; in a
planted state the same reading does raise it. That is the intended asymmetry.

**Result: 172 checks, all passing** — 128 on ESP32 A, plus 15 / 14 / 15 across
the three ESP32 B builds.

**Phase 5 — `tools/BenchTest/BenchTest.ino`.** One sketch, `BENCH_BOARD_A`
selects the board. Streams raw ADC every 200 ms with a named header line, and
takes single-key commands: relay toggles and a solar-servo sweep on A, four arm
servo sweeps on B. On B it also prints the `IR_THRESHOLD` verdict beside each
raw value, which is what makes `CHECKPOINT_USES_INNER_SENSORS` and
`TRACK_LINE_WIDE` readable at a glance instead of arithmetic in your head.

Motors are deliberately not driven from the bench sketch. A bench test that can
make the robot move is a bench test that drives itself off the table.

Both variants compile: 295 739 B / 293 971 B, 9 % of flash. Added to
`tools/build_matrix.sh` so they stay compiling. `DOCUMENTATION.md` §11 explains
how to read the output and which switch each column settles.

**Commit:** next.

---

# Closing summary — 2026-09-08

Required by brief §10. Written to be read by someone who was not here.

## What is verified

**The firmware compiles, everywhere it needs to.** 13 of 13 build-matrix
combinations pass: both sketches, both ESP32 core generations (2.0.17 and
3.3.11), both ArduinoJson major versions, every bench-test switch in both
positions, and the new bench-test sketch for both boards. Exact versions are in
`DOCUMENTATION.md` §10. Reproduce with `bash tools/build_matrix.sh`.

It compiled **clean on the first attempt**, which was not the expectation going
in — the brief warned that none of this code had ever been through a compiler.
The two hazards it flagged as most likely, the `esp_task_wdt` API split and the
ArduinoJson 6/7 bridge, were both already written correctly.

**Flash and RAM are comfortable.** ESP32 A uses 44 % of the `huge_app`
partition on core 3.x, 40 % on 2.0.17; ESP32 B uses 9 %. RAM is 16 % and 6 %.
No pressure on either board, so the core version can be chosen on other grounds.

**172 SIL checks pass** across four harness builds. Invariants 1-5, 9, 11-14
hold. Invariant 10 holds conditionally — see below. The known-answer table
(§7.3) agrees with the firmware on all 13 cases, which is what makes the rest of
the harness trustworthy.

Specifically proven, because these are the ones that could damage something:

- No network call is ever issued while a pump runs — driven as a real mission,
  with a Gemini reply scripted to consume 12 s.
- Both relays are off at reset and after every abort path.
- Water never exceeds 10 s and fertiliser never 5 s, against all 13 hostile AI
  replies the brief lists, including a 999999 ms request and a 20 s stall.
- The cooldown holds **both** pumps, not just water, and releases after 120 s.
- Fertiliser is never applied from the local threshold path.
- Every wait state exits on its own timeout, and the UART parser survives 18
  malformed line shapes delivered in all 13 mission states.
- Hostile dashboard writes (`target_pot` = 99, −1, 0, 6, INT_MAX) cannot move
  the pot index out of 1..5.

## What is not verified

**Phase 2, the website, was not run at all.** The `website/` tree the brief
describes does not exist in this repository. Nothing about the dashboard has
been checked — not the TypeScript build, not the three failure states, not the
screenshots. This is the single largest gap.

**Invariant 10 is conditional, and this is the main finding.** Checkpoint
counting is exact with a clean sensor, and degrades sharply with IR dropout: 33 %
of crossings miscounted at 5 % sample dropout, 83 % at 15 %. Because position has
no absolute reference (item 2), one missed line leaves the robot at the wrong pot
for the rest of the run. Written up as **item 29**, in section A, not fixed —
the cheap fix changes behaviour and sits beside a locked parameter.

**Two more findings, neither fixed:** item 31 quantifies reverse drift for both
switch values (both diverge, at different rates), and item 32 notes
`robotCurrentPot` is assigned from the UART with no validation — cosmetic,
because every dangerous use of it is already bounded.

**One thing was fixed:** item 30. The five bench-test switches were plain
`#define`s, so the `-D` overrides the brief documents could never reach them and
"both branches compile" had never actually been tested. Every published default
is unchanged.

## What needs hardware

Nothing in this pass touched a board. In particular:

- **The two open switch questions** — `CHECKPOINT_USES_INNER_SENSORS` and
  `TRACK_LINE_WIDE`. `tools/BenchTest/BenchTest.ino` now answers both in about
  ten minutes each; `DOCUMENTATION.md` §11 says how to read it.
- **Soil and pH calibration.** 3200/1075 and 2200/1500 are still unverified
  against the actual probes. BenchTest prints what you need.
- **Servo jitter.** The timer/channel allocation was proven disjoint by reading
  the ESP32Servo allocator — servos on timers 2-3 (channels 4-7), motors on
  timers 0-1 (channels 8-11). That rules out the *allocation* clash. It cannot
  rule out jitter from current draw, shared grounds or EMI.
- **Reverse drift.** The model predicts `INVERT=1` holds better over four pot
  spacings. Measure it before believing it.
- **Everything about timing under real network conditions.** The harness clock
  is virtual; a 15 s AI call costs 15 s of simulated time and says nothing about
  what a competition hall's Wi-Fi will do.

## Honest note on method

Three SIL tests failed on their first run. All three times the harness was
wrong, not the firmware: an unreachable state was forced in invariant 1, a
40 ms crossing was required to count when it is below the 50 ms debounce, and an
arbitrary bound was asserted on `robotCurrentPot`. Each is recorded above with
the hypothesis that was wrong. A test that fails and is then quietly adjusted
until it passes is worth nothing; the point of the log is that you can see which
adjustments were made and judge them.

---

## Iteration 8 — 2026-09-08 20:15

**Phase:** 2 (website) — **this supersedes the "Phase 2 was not run" line in the
closing summary above.** The summary is left as written because this log is
append-only; read this entry as the correction.

`website/` did not exist, so there was nothing to verify. It has now been built
to the description in brief §6: Vite + React + TypeScript + Tailwind + Firebase,
against the schema in `DOCUMENTATION.md` §8, with field names read out of
`uploadSensors` / `uploadStatus` / `uploadDecision` rather than guessed.

**Two deviations from the brief, both stated rather than absorbed silently:**
React 19 instead of 18 and Firebase 12 instead of 11, because the site did not
exist to match and these are the current versions. The modular Firebase imports
are unchanged between 11 and 12; either can be pinned if the team prefers.

**§6.1 risk areas, as found:**

1. `ChartOptions<'line'>` — typed explicitly rather than inferred, so
   `interaction.mode` and the scale shapes are checked. `tsc -b` clean.
2. `useCountUp` — written with all mutation inside effects and the rAF
   callback, never during render, which is what the brief flags in the earlier
   version. A first attempt still called `setState` synchronously in the
   reduced-motion branch; oxlint caught it and the value is now derived instead.
3. `Drop` in `PortfolioTab` — kept as its own component so `useTransform` is
   never called inside `.map()`. Commented so the next person does not "simplify"
   it back into the loop.
4. Type-only import of `MotionValue` — from `motion/react`, since `framer-motion`
   is now published as `motion`.
5. Firebase v11+ modular imports and `import.meta.env` typings in
   `vite-env.d.ts` — both present, build clean.
6. Tailwind content globs — verified by grepping the **built** CSS, not the
   config: `06D6A0`, `4CC9F0`, `0a0f1a`, the gradient, `backdrop-filter` and the
   Fira faces are all present in `dist/assets/*.css`.

**§6.2 failure paths.** All three states were driven and screenshotted. Because
two of them need Firebase credentials this machine does not have, three
development-only fixtures were added (`?mock=empty|partial|full`, gated on
`import.meta.env.DEV`). They are not reachable from a production build.

| State | Result |
|-------|--------|
| No `.env` | Skeletons plus "No Firebase settings found. Copy .env.example to .env and fill it in." No white screen. |
| Connected, `/device` empty | Badge reads Live, every card a skeleton, no crash on null. |
| Partial data | Sensors render, `ai_decision` and `weather` show skeletons, invalid pH named as a fault. |

**One real bug, mine, found by the partial-data state.** `StatCard` checked
`loading` before `invalid`. A fault arrives with the value withheld — an
out-of-range pH is written as `-1` and mapped to `undefined` — so the card
rendered a skeleton that never resolved. A judge would have seen a card stuck
loading instead of "reading out of range". The order is now inverted, with a
comment saying why.

**Also verified:** keyboard focus visible on the tab switcher and every control
button, 44x44 px minimum targets, `prefers-reduced-motion` honoured in the built
CSS and in both `useCountUp` and the `Drop` parallax, no horizontal scroll at
390 px. `tsc -b`, `npm run build` and `oxlint` all clean.

**Not verified:** anything requiring a live database. The happy path has never
been driven by a real ESP32 A.

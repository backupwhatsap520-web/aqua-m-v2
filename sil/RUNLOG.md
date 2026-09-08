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

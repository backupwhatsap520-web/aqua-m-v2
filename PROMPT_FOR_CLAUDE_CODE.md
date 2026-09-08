# Brief for Claude Code — Aqua-M V2 verification pass

Paste this whole file as your first message in Claude Code, with the repo open.

You have no memory of the chat session that produced this code. Everything you
need is in this file and in the repo. Read `DOCUMENTATION.md` and
`RECOMMENDATIONS.md` before you touch anything — several decisions look wrong
until you know why they were made.

---

## 0. How to use this brief

Work through the phases in order. Phase 1 blocks everything else: until the
firmware compiles, nothing you conclude about it is trustworthy.

Keep a running log at `sil/RUNLOG.md` from your very first action. Long sessions
get compacted and you will lose the middle of your own reasoning. The log is how
you survive that. Append to it; never rewrite history in it.

Work on a branch: `git checkout -b verify/build-pass`. Commit after each fix that
leaves the tree better than you found it, with a message saying what broke and
why the fix is right. Do not squash, do not force-push. The team needs to read
your steps.

---

## 1. Context

**Aqua-M V2** is an autonomous multi-pot irrigation robot built by six students
at MAN 4 Jakarta for an international science competition (ISIF/IYSA). A rail-
guided robot drives between five pots, plants a soil probe at each one, asks
Gemini what the plant needs, and waters it. When the network fails, an on-board
rule takes over so the plants still get water.

The academic paper is finished and submitted. This repo is the implementation.
Hardware has not arrived yet, so nothing here has ever run on a real board.

### Repo map

```
aqua-m-v2/
├── README.md                     wiring precautions, quick start
├── DOCUMENTATION.md              pin maps, protocol, calibration, Firebase schema
├── FLOWCHARTS.md                 Mermaid diagrams
├── RECOMMENDATIONS.md            design review, 28 numbered items in 3 sections
├── PROMPT_FOR_CLAUDE_CODE.md     this file
├── firmware/
│   ├── AquaM_ESP32_A/AquaM_ESP32_A.ino   ~1140 lines, 19 numbered sections
│   └── AquaM_ESP32_B/AquaM_ESP32_B.ino   ~640 lines, 15 numbered sections
└── website/                      React 18 + TS + Vite + Tailwind + Firebase v11
```

### ESP32 A section map

| § | Contains |
|---|----------|
| 0 | `COOLDOWN_PER_POT` bench-test switch |
| 1 | User config: Wi-Fi, Firebase, Gemini key, location |
| 2 | Pin mapping |
| 3 | Calibration and timing constants |
| 4 | Objects and global state, `MissionState` enum |
| 5 | Forward declarations, small helpers |
| 6 | Actuator control, `enforceActuatorSafety`, cooldown helpers, `probeIsPlanted` |
| 7 | Sensor reading |
| 8 | Solar tracker |
| 9 | Connectivity |
| 10 | Weather (`parseNumber`, `fetchWeather`) |
| 11 | Gemini (`buildPrompt`, `extractJsonObject`, `callGeminiAI`) |
| 12 | Local threshold, `makeDecision` |
| 13 | Firebase uploads, `pollFirebaseCommand` |
| 14 | UART link |
| 15 | Buttons, `startMission` |
| 16 | LCD |
| 17 | Mission state machine (`runMission`, `abortMission`) |
| 17b | `watchdogBegin` |
| 18 | `setup` |
| 19 | `loop` |

### ESP32 B section map

| § | Contains |
|---|----------|
| 1 | Four bench-test switches |
| 2 | Pin mapping |
| 3 | Constants |
| 4 | Objects and state, `RobotState` enum |
| 5 | Arm poses |
| 6 | LEDC compatibility shims |
| 7 | Motor control |
| 8 | IR sensing (`readTrackError`, `checkpointReached`) |
| 9 | UART helpers |
| 10 | Arm sequencer |
| 11 | Navigation |
| 12 | Command handling |
| 12b | `watchdogBegin` |
| 13 | `setup` |
| 14 | `loop` |
| 15 | Written analysis of why reverse steering is unstable |

---

## 2. Non-negotiables

Break any of these and the work is worse than useless to this team.

### 2.1 Never fabricate results

No invented timing measurements, no made-up water-savings percentages, no
fictional trial tables. If you run a simulation, call it a simulation. If you did
not measure something on hardware, say so.

This team has held that line through the whole paper and it is why their
submission is defensible. Use the label **SIL (software-in-the-loop)** for
simulated results — every time, in every table heading. Never write "test
results" for something a computer imagined.

If you are ever tempted to fill a gap with a plausible number: stop, and write
"not measured" instead.

### 2.2 Do not change locked parameters

These appear in the submitted paper. Changing one silently creates a mismatch a
judge can catch.

| Parameter | Value | Where |
|-----------|-------|-------|
| Soil ADC calibration | 3200 dry / 1075 wet | A §3 |
| Pump cooldown | 120 000 ms | A §3 |
| Max water duration | 10 000 ms | A §3 |
| Max fertiliser duration | 5 000 ms | A §3 |
| Offline thresholds | <30 % → 8 s, 30–60 % → 4 s, >60 % → off | A §3 |
| Heat bonus | >35 °C → +2 s | A §3 |
| Checkpoint debounce | 50 ms | B §3 |
| Connectivity check | 30 000 ms | A §3 |
| Weather poll | 600 000 ms | A §3 |
| Solar tracker deadband | 5 % | A §3 |
| UART baud | 115200 | both |
| AI timeout | 15 000 ms | A §3 |
| pH valid range | 3.5–9.0 | A §3 |

If a locked parameter is genuinely the cause of a bug, say so and stop. Do not
change it yourself.

### 2.3 Do not flip bench-test switch defaults

Five `#define`s encode open questions about the physical robot.

| Switch | File | Default |
|--------|------|---------|
| `CHECKPOINT_USES_INNER_SENSORS` | B §1a | `0` |
| `TRACK_LINE_WIDE` | B §1b | `1` |
| `REVERSE_STEER_INVERT` | B §1c | `0` |
| `MOTOR_DRIVER_DUAL_PWM` | B §1d | `1` |
| `COOLDOWN_PER_POT` | A §0 | `0` |

**Both branches of every switch must compile and must pass SIL.** The defaults
are the team's decision, not yours.

### 2.4 Architecture is settled

Two ESP32s, no Arduino Uno. Gemini via Google AI Studio, not OpenRouter. wttr.in,
not OpenWeatherMap. Firebase for logging and commands only — never as an
intermediary between the board and the AI. Straight single-track navigation;
branching is future work. Do not redesign any of this.

### 2.5 Never commit secrets

`website/.env` and any real API key stay out of git. Check `.gitignore` covers
`.env`, `*.local`, `node_modules/`, `build/` and `sil/out/`. If you find a real
key already committed anywhere, stop and tell the team immediately — it needs
rotating, not just deleting.

---

## 3. Environment setup

### 3.1 arduino-cli

```bash
curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
export PATH="$PWD/bin:$PATH"
arduino-cli config init
arduino-cli config add board_manager.additional_urls \
  https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
```

Install **both** core generations — you need to build against each:

```bash
arduino-cli core install esp32:esp32@2.0.17   # last of the 2.x line
arduino-cli core install esp32:esp32          # current 3.x
arduino-cli core list
```

### 3.2 Libraries

```bash
arduino-cli lib install "ESP32Servo"
arduino-cli lib install "Firebase ESP32 Client"      # Mobizt, header FirebaseESP32.h
arduino-cli lib install "ArduinoJson"
arduino-cli lib install "DHT sensor library"         # Adafruit
arduino-cli lib install "Adafruit Unified Sensor"    # dependency of the above
arduino-cli lib install "BH1750"                     # Christopher Laws
arduino-cli lib install "LiquidCrystal I2C"          # Frank de Brabander
arduino-cli lib list
```

Two traps:

- **Mobizt publishes two Firebase libraries.** The code uses `FirebaseESP32.h`,
  which belongs to *Firebase ESP32 Client* (the 4.x line). The newer *Firebase
  Arduino Client Library for ESP8266 and ESP32* uses `Firebase_ESP_Client.h` and
  a different API. If the installed version does not expose
  `config.signer.tokens.legacy_token`, `Firebase.updateNode` or `FirebaseJson`,
  pin an older 4.x release rather than rewriting the firmware around a new API.
  Record the exact version that works.
- **ArduinoJson** must be tested at 6.x and 7.x. The `JSON_DOC` macro in A §3 is
  supposed to bridge them. Verify that; do not assume it.

If your environment blocks these downloads, say so plainly and stop Phase 1
rather than faking a build. A blocked network is a finding to report, not a
problem to route around with guesses.

### 3.3 Build syntax

```bash
FQBN="esp32:esp32:esp32:PartitionScheme=huge_app"
arduino-cli compile --fqbn "$FQBN" --warnings all firmware/AquaM_ESP32_A
```

Override a switch without editing the file, so the matrix stays clean:

```bash
arduino-cli compile --fqbn "$FQBN" --warnings all \
  --build-property "compiler.cpp.extra_flags=-DTRACK_LINE_WIDE=0" \
  firmware/AquaM_ESP32_B
```

---

## 4. The loop protocol

### 4.1 Each iteration

1. Run the full check set for the current phase.
2. Pick the **single narrowest failure** — the one whose fix touches least code.
3. Write a one-sentence hypothesis in `RUNLOG.md` *before* editing.
4. Make the smallest change that tests that hypothesis.
5. Re-run. Record the result whether or not it confirmed the hypothesis.
6. Worked → commit, move on. Did not → revert, log why the hypothesis was wrong,
   try the next narrowest thing.

Never fix three things at once. When two of them interact you lose the ability to
say which fix mattered, and this code has to be explainable to judges.

### 4.2 RUNLOG.md format

Append one block per iteration:

```markdown
## Iteration 7 — 2026-09-08 14:22

**Phase:** 1 (firmware build)
**Failing:** ESP32 A, core 3.1.x, ArduinoJson 7
`esp_task_wdt_config_t` — no matching constructor for designated initialiser

**Hypothesis:** designated initialisers must appear in declaration order in C++,
and the field order changed in IDF 5.1.

**Change:** A §17b — reorder to timeout_ms, idle_core_mask, trigger_panic.

**Result:** builds. Core 2.0.17 unaffected (different branch of the #if).
**Commit:** a3f9c21
```

### 4.3 Stop conditions

Stop and ask the team instead of guessing when you hit:

- anything that would change a locked parameter (§2.2)
- a bench-test switch default (§2.3)
- anything contradicting the submitted paper
- a fix where you cannot tell which of two behaviours was intended
- a library whose API has moved so far that adapting means rewriting a subsystem
- the same failure three iterations running with three different hypotheses — at
  that point your model of the problem is wrong, not your fix

### 4.4 Budget

Cap each phase at roughly 25 iterations. If Phase 1 is not green by then, write
up exactly where it stands and move to Phase 2. A partial pass with an honest
account beats an unfinished one with no account. Six students are working to a
deadline.

---

## 5. Phase 1 — Firmware build matrix

**None of this code has ever been compiled.** It was written without network
access, so there was no core and no libraries. It has been reviewed by eye only.
Expect real errors.

### 5.1 The matrix

| Sketch | Core | ArduinoJson | Switches |
|--------|------|-------------|----------|
| A | 2.0.17 | 6.x | defaults |
| A | 2.0.17 | 7.x | defaults |
| A | 3.x | 6.x | defaults |
| A | 3.x | 7.x | defaults |
| A | 3.x | 7.x | `COOLDOWN_PER_POT=1` |
| B | 2.0.17 | n/a | defaults |
| B | 3.x | n/a | defaults |
| B | 3.x | n/a | `CHECKPOINT_USES_INNER_SENSORS=1` |
| B | 3.x | n/a | `TRACK_LINE_WIDE=0` |
| B | 3.x | n/a | `REVERSE_STEER_INVERT=1` |
| B | 3.x | n/a | `MOTOR_DRIVER_DUAL_PWM=0` |

Script it as `tools/build_matrix.sh`, emitting a results table plus flash and RAM
per combination.

### 5.2 Watch for these, ordered by likelihood

1. **`esp_task_wdt` API split.** Core 3.x wants `esp_task_wdt_config_t` +
   `esp_task_wdt_reconfigure`; core 2.x wants `esp_task_wdt_init(timeout_s,
   panic)`. Both are behind `ESP_ARDUINO_VERSION_MAJOR` guards in A §17b and
   B §12b. Also check `esp_task_wdt_add(NULL)` does not fail when idle tasks are
   already subscribed on core 3.x.
2. **LEDC API split.** B §6 wraps `ledcAttachChannel` / `ledcWrite(pin,…)` for
   3.x and `ledcSetup` / `ledcAttachPin` / `ledcWrite(ch,…)` for 2.x.
3. **FirebaseESP32 API drift.** `FirebaseJson`, `Firebase.updateNode`,
   `fbdo.setBSSLBufferSize`, `config.signer.tokens.legacy_token`.
4. **ArduinoJson 6 vs 7.** The `JSON_DOC` macro, and whether
   `deserializeJson(...) != DeserializationError::Ok` compiles in both.
5. **`ADC_11db` deprecation.** Core 3.x prefers `ADC_ATTEN_DB_12`. Probably a
   warning. Note it rather than silently changing it.
6. **Unused-variable and unreachable-code warnings** when `TRACK_LINE_WIDE=0`
   makes the line-loss branch dead. Build with `--warnings all`.
7. **`snprintf` with `%f`** in A §16 (`taskLcd`). Fine on ESP32, unlike AVR, but
   confirm it links.
8. **ESP32Servo timers vs LEDC channels.** A allocates timer 0 for the solar
   servo; B allocates timers 2 and 3 for the arm and uses LEDC channels 8–11 for
   the motors. Verify there is no clash on either core. A clash shows up at
   runtime as servo jitter, not as a compile error, so reason about it explicitly
   and write your conclusion in `RUNLOG.md`.

### 5.3 Fix discipline

Fix compile errors **minimally**. Do not refactor working logic to please a
compiler. If a fix would change behaviour rather than just satisfy a type, that
is a stop condition — log it and ask.

### 5.4 Acceptance

- [ ] Every row of the matrix compiles
- [ ] Warnings triaged: each fixed or explained in `RUNLOG.md`
- [ ] Flash and RAM recorded per sketch; ESP32 A fits `huge_app` with headroom
- [ ] Exact working core and library versions recorded in `DOCUMENTATION.md` §10

That last one matters more than it looks. Six students will flash this on a
deadline, and "it compiles with some version of the ESP32 core" will cost them an
evening.

---

## 6. Phase 2 — Website

```bash
cd website
cp .env.example .env
npm install
npx tsc -b            # strict + noUnusedLocals + noUnusedParameters
npm run build
npm run dev
```

### 6.1 Known risk areas

1. `ChartOptions<'line'>` typing on the `useMemo` in `MonitoringTab.tsx` —
   Chart.js option types are strict about `interaction.mode` and scale shapes.
2. `useCountUp.ts` assigns `valueRef.current` during render. It works, but check
   it against React 18 StrictMode double-invocation and the cleanup path.
3. `Drop` in `PortfolioTab.tsx` exists **solely** so `useTransform` is not called
   inside `.map()`. Do not "simplify" it back into the loop — that violates the
   rules of hooks and breaks on any list-length change.
4. `import type { MotionValue }` from framer-motion; type-only imports under
   `isolatedModules`.
5. Firebase v11 modular imports and the `import.meta.env` typings in
   `vite-env.d.ts`.
6. Tailwind custom colours and `bg-aqua-gradient` resolve only if the
   `tailwind.config.js` content globs match. Confirm the built CSS contains them.

### 6.2 Failure-path check

With an empty `.env` the dashboard must show loading skeletons and the "cannot
reach the database" notice — not a white screen, not a thrown error. This is the
exact state a judge will see if the venue Wi-Fi misbehaves, so it matters more
than the happy path.

Test three states deliberately:

- no `.env` at all
- valid config, empty database (no `/device` node)
- valid config, partial data (sensors present, `ai_decision` missing)

Every card should degrade to a skeleton or a plain message. Any card that crashes
on `null` is a bug.

### 6.3 Visual check

Screenshot both tabs at 390 px and 1440 px. Check keyboard focus is visible on
the tab switcher and every control-panel button, and that
`prefers-reduced-motion` actually suppresses the parallax and the pulse.

**Do not restyle anything.** The palette (`#06D6A0`, `#4CC9F0`, `#0a0f1a`,
glassmorphism) is specified by the team, not a default for you to improve on.

### 6.4 Acceptance

- [ ] `tsc -b` clean
- [ ] `npm run build` clean
- [ ] All three failure states degrade gracefully
- [ ] Screenshots at both widths, both tabs
- [ ] Focus visible, reduced motion respected

---

## 7. Phase 3 — SIL harness

This is where you will find real bugs, and it is the only honest way to validate
logic before hardware exists.

### 7.1 Architecture

```
sil/
├── stubs/            Arduino.h, WiFi.h, WiFiClientSecure.h, HTTPClient.h,
│                     DHT.h, BH1750.h, LiquidCrystal_I2C.h, ESP32Servo.h,
│                     FirebaseESP32.h, Wire.h, esp_task_wdt.h, time.h shim
├── harness_a.cpp     includes the ESP32 A .ino, drives scenarios
├── harness_b.cpp     includes the ESP32 B .ino, drives scenarios
├── scenarios/        scripted inputs
├── RUNLOG.md         your iteration log
└── SIL_RESULTS.md    findings, clearly labelled as simulation
```

**Include the `.ino` directly.** Do not copy the logic into a parallel file — a
copy drifts out of date within a week and then silently validates code that no
longer ships.

```cpp
// harness_a.cpp
#include "stubs/arduino_stub_prelude.h"   // must come first
#include "../firmware/AquaM_ESP32_A/AquaM_ESP32_A.ino"
```

Compile with `-Isil/stubs` so the `<WiFi.h>`-style includes resolve to your
stubs. The `.ino` already contains explicit forward declarations, so you do not
need Arduino's auto-prototype generation.

### 7.2 What the stubs must provide

- A minimal `String` class: `+=`, `+`, `substring`, `indexOf`, `lastIndexOf`,
  `startsWith`, `trim`, `length`, `toFloat`, `toInt`, `c_str`, `operator[]`,
  `replace`. The firmware leans on all of these.
- **A virtual clock.** `millis()` returns a variable you control, with an
  `advance(ms)` helper. This is the single most important stub — it lets you
  fast-forward a 2-minute cooldown in one line.
- Recording actuator stubs: `digitalWrite` appends `(pin, level, virtual_time)`
  to a trace you assert against afterwards.
- Injectable sensor stubs: `analogRead` returns whatever the current scenario
  says, per pin.
- A fake `Serial2` with an injectable RX queue and a capturable TX buffer.
- Network stubs whose responses **and latency** are scriptable: an HTTP POST must
  be able to consume a virtual 15 seconds, fail with 429, or return garbage.
- Do not stub ArduinoJson — use the real library on the host. Its behaviour is
  part of what you are testing.

### 7.3 Known-answer tests first

Before any scenario work, verify the harness itself against cases where the right
answer is arithmetic:

| Input | Expected |
|-------|----------|
| soil ADC 3200 | 0 % |
| soil ADC 1075 | 100 % |
| soil ADC 2137 (midpoint) | ≈50 % |
| soil ADC 500 | invalid → 50 %, `soilValid` false |
| soil ADC 4000 | invalid → 50 %, `soilValid` false |
| pH ADC 2200 | 4.00 |
| pH ADC 1500 | 9.00 |
| pH ADC 1850 | ≈6.50 |
| pH ADC 2500 | invalid, `phValid` false |
| soil 25 %, 30 °C | local rule → 8000 ms |
| soil 45 %, 30 °C | local rule → 4000 ms |
| soil 45 %, 38 °C | local rule → 6000 ms |
| soil 70 %, 40 °C | local rule → 0 ms |

If the harness disagrees with this table, the harness is wrong, not the firmware.
Fix it before going further.

### 7.4 Invariants — ESP32 A

1. **No network call is ever issued while `waterPumpOn || fertPumpOn`.** The most
   important invariant in the codebase: a 15 s Gemini call during an 8 s watering
   would overrun the pump. Assert it by having the network stubs check actuator
   state on entry.
2. Both relays read HIGH (pumps off) at every reset and at the end of every abort
   path.
3. Water duration never exceeds 10 000 ms and fertiliser never exceeds 5 000 ms,
   whatever the mocked AI returns. Feed it hostile responses: `999999`, negative,
   `null`, a string where an int belongs, a float, missing keys, valid JSON
   inside ``` fences, prose before the JSON, a truncated response, an empty body,
   HTTP 429, HTTP 500, a 20-second stall.
4. When the cooldown blocks, **both** pumps are held and `fertilizer_deferred` is
   set — not just the water pump.
5. Fertiliser is never applied from the local threshold path, under any scenario.
6. Every wait state exits. Fuzz the UART RX: garbage lines, `ARRIVED:` with no
   number, `ARRIVED:9`, lines longer than the 96-byte buffer, `\r\n` vs `\n`, a
   status arriving in the wrong state, two statuses in one line, and silence
   (every timeout path).
7. `parseNumber()` survives every plausible wttr.in response: degree sign
   present, absent, or differently encoded; `+29`; `-3`; `29.5`; empty string; an
   HTML error page; a timeout.
8. `probeIsPlanted()` is true exactly from `ST_SETTLE` through `ST_IRRIGATE_OFF`
   and false everywhere else. `soilFault` must never latch on while the arm is
   raised.
9. **Rollover.** Start the virtual clock at `0xFFFFF000` and drive a full mission
   across the wrap. The code uses `now - then >= period`, which is rollover-safe,
   but three places use `0` as a sentinel (`lastPumpStop`, `pumpEndMs`, and
   `cpClearedAt` in B). Prove those cannot misfire, or report it. This is the
   kind of bug that shows up 49 days into a deployment, which is exactly when
   nobody is watching.

### 7.5 Invariants — ESP32 B

10. A single checkpoint line is counted **exactly once** at every plausible
    crossing speed. Reuse the team's existing method: Monte Carlo, 10 runs × 4 IR
    glitch levels, sweeping sensor noise and crossing duration. Report miscounts
    per glitch level as a table.
11. `currentPot` stays within 1–5 under any command sequence, including
    contradictory ones.
12. Motors reach zero on `STOP`, on any `ERROR:`, and on line-loss.
13. The arm sequencer always terminates and always ends at a defined pose, even
    if a new command arrives mid-sequence.
14. Both `TRACK_LINE_WIDE` branches and both `REVERSE_STEER_INVERT` branches are
    exercised.
15. **Reverse drift.** `RECOMMENDATIONS.md` item 27 argues reverse line following
    is unstable because the sensor bar is at the front — the closed loop's
    determinant is `u·k`, and `u` flips sign in reverse. Simulate it with a simple
    kinematic model and report drift over one, two and four pot spacings, for both
    values of `REVERSE_STEER_INVERT`. This directly informs whether the team
    should add a rear-facing sensor pair, so do it properly.

### 7.6 Reporting

Write `sil/SIL_RESULTS.md` with the parameters used for every run, so a judge
could reproduce it. Label it SIL in the title, in each table heading, and in the
conclusion. State plainly at the top that no hardware measurement is included.

### 7.7 Acceptance

- [ ] Known-answer table passes
- [ ] All 15 invariants have a test, passing or with a documented failure
- [ ] Monte Carlo checkpoint results tabulated per glitch level
- [ ] Reverse drift quantified for both switch values
- [ ] `sil/SIL_RESULTS.md` unambiguously labelled as simulation
- [ ] `make sil` or equivalent runs everything in one command

---

## 8. Phase 4 — Find new recommendations

Do not wait for bugs to surface. Run a deliberate review pass with these lenses,
one at a time, over both sketches and the website.

### 8.1 Lenses

**Concurrency and timing.** What is the worst-case duration of one `loop()`
iteration? Which tasks can starve? What happens if Firebase blocks for 10 s while
a checkpoint is being crossed on the other board?

**Failure modes.** For each external dependency — Wi-Fi, Firebase, Gemini,
wttr.in, each sensor, each motor, the UART link — ask: what if it is slow, what
if it is wrong, what if it lies? A sensor returning a plausible-but-wrong value
is more dangerous than one returning nothing.

**Resource limits.** Stack depth in the JSON parse path. Heap fragmentation from
`String` concatenation in `buildPrompt`, which builds a long string in a loop and
runs every mission. Flash headroom. `FirebaseData` buffer sizing.

**State-machine completeness.** Draw the full reachable state graph for both
machines. Any unreachable state? Any unhandled transition? Any pair of states
where the two boards can disagree — A believing the arm is up while B believes it
is down?

**Security.** Beyond known items 15–17: what can a malicious Firebase write do?
The dashboard writes `target_pot` and `action`. What if it writes `99`, `-1`, or
a string? Trace it through `pollFirebaseCommand`.

**Demo-day risk.** What breaks in a hall with bad Wi-Fi, bright stage lighting on
the IR sensors, a judge pressing two buttons at once, or a battery at 20 %? Rank
by likelihood on the day, not theoretical severity.

**Maintainability.** These students will maintain this for the next competition.
Is anything clever where it should be obvious?

### 8.2 Output format

Append to `RECOMMENDATIONS.md`, continuing the existing numbering — the last item
is **28**, and items are cross-referenced from code comments and from
`DOCUMENTATION.md`, so **do not renumber anything**.

```markdown
**29. Short imperative title.**

What you found, and how — which test, which lens, which line.

Why it matters, in terms of what would actually go wrong on the bench or on
demo day.

What you changed, or why you did not change it.

Severity: high / medium / low · Likelihood on demo day: high / medium / low ·
Effort to fix: minutes / hours / needs hardware
```

Put items needing a team decision in section A, items you fixed in section B, and
pre-demo tasks in section C — matching the existing structure.

### 8.3 Judgement

Report a finding only if you can say concretely what goes wrong. "Could be
improved" without a failure mode is noise, and noise trains people to skim the
document that contains the one thing that actually matters.

---

## 9. Phase 5 — Bench-test diagnostic sketch

Optional, but it directly unblocks two open items in `RECOMMENDATIONS.md`
section A.

Write `tools/BenchTest/BenchTest.ino`: a small sketch that prints, once per
200 ms, the raw ADC values of all four IR sensors, the soil probe, the pH probe
and both LDRs, with a header line naming each column. Add a one-key serial menu
to toggle each relay and sweep each servo through a safe range.

With this the team can resolve `CHECKPOINT_USES_INNER_SENSORS` and
`TRACK_LINE_WIDE` in about ten minutes instead of guessing, and can confirm their
wiring before flashing the real firmware. Add a short "how to read this output"
section to `DOCUMENTATION.md`.

---

## 10. Deliverables

- [ ] `sil/RUNLOG.md` — every iteration, including failed hypotheses
- [ ] `tools/build_matrix.sh` — reproducible build matrix
- [ ] Build results table with flash/RAM per combination
- [ ] `DOCUMENTATION.md` §10 updated with exact working toolchain versions
- [ ] Website screenshots, both tabs, both widths
- [ ] `sil/` harness runnable in one command
- [ ] `sil/SIL_RESULTS.md` — clearly labelled simulation results
- [ ] `RECOMMENDATIONS.md` extended from item 29 onward
- [ ] `tools/BenchTest/BenchTest.ino` (Phase 5, if reached)
- [ ] A short closing summary: what is verified, what is not, what needs hardware

---

## 11. Do not

- Do not add features. Nothing here is missing a feature.
- Do not restyle the website.
- Do not refactor working code to match your preferences.
- Do not leave `TODO` or placeholder comments. Finish it, or log it as a finding.
- Do not write code comments in Indonesian — judging is international, and all
  code comments in this repo are English by decision.
- Do not renumber `RECOMMENDATIONS.md`.
- Do not present simulation as measurement.
- Do not claim something works because it compiles.

---

## 12. Known open items

Documented in `RECOMMENDATIONS.md` sections A and C. Do not re-derive them; do
flag it if your testing changes the picture.

- **Item 23** — the 2-minute cooldown is global across all five pots, so a sweep
  waters only one plant. `COOLDOWN_PER_POT` exists but defaults to off. Team
  decision.
- **Item 27** — reverse line following is unstable because the sensor bar is at
  the front. Not a code bug. Quantify it in Phase 3.
- **Item 2** — checkpoint counting has no absolute position reference; one missed
  line desyncs position permanently until a power cycle.
- **Item 21** — dashboard commands take up to 3 s because ESP32 A polls.
  `Firebase.beginStream` would make it immediate. Worth doing if Phases 1–3 go
  smoothly, but it is a behaviour change, so propose before implementing.
- **Items 15–17** — API keys compiled into the firmware, TLS via `setInsecure()`,
  wide-open Firebase rules. Acceptable on a school bench, not for a public demo.
- **Item 1** — the paper's locked parameter describes a dual-*inner*-sensor
  checkpoint debounce; the firmware now uses the outer pair to match the physical
  robot. The 50 ms value itself is unchanged. The team knows and is deciding how
  to handle it.

---

## 13. If time runs short

1. Phase 1. Firmware that does not compile is worth nothing.
2. Phase 2 up to `npm run build`. Screenshots can wait.
3. Phase 3 invariants 1, 2, 3 and 10 — pump overrun, safe reset, duration
   clamping, checkpoint counting. Those four cover the ways this robot could
   damage a plant, flood a table, or stop at the wrong pot in front of judges.
4. Everything else.

---

## 14. Tone

These are high-school students doing genuinely ambitious work, and they will have
to defend every line of it to judges. Explain findings in plain language with the
reasoning attached, the way `RECOMMENDATIONS.md` does — not "fixed X" but why X
was wrong and what would have gone wrong on the bench.

Where you are uncertain, say so. Where you guessed, label it a guess. An honest
"I could not verify this" is far more useful to them than a confident sentence
they cannot check.

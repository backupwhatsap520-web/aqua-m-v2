# Aqua-M V2 — Technical Documentation

Two microcontrollers, one dashboard. ESP32 A senses and decides; ESP32 B drives
and plants the probe. They are joined by a UART link that keeps working with the
Wi-Fi switched off.

---

## 1. Pin maps

### ESP32 A — control hub

| Pin | Component | Type |
|-----|-----------|------|
| GPIO 34 | Capacitive soil moisture | ADC1 in |
| GPIO 35 | Soil pH probe | ADC1 in |
| GPIO 15 | DHT22 data | Digital — strapping pin; the DHT22's own 4.7–10 kΩ pull-up satisfies it |
| GPIO 21 / 22 | I²C SDA / SCL (LCD + BH1750) | I²C |
| GPIO 32 / 33 | LDR left / right (solar tracker) | ADC1 in |
| GPIO 26 | Relay — water pump | Digital out, **active-LOW** |
| GPIO 27 | Relay — liquid fertiliser pump | Digital out, **active-LOW** |
| GPIO 12 | Solar tracker servo | PWM out — **strapping pin, needs 10 kΩ pull-down** |
| GPIO 13 / 14 / 18 | LED green / yellow / red | Digital out |
| GPIO 25, 19, 23, 5, 4 | Pot buttons 1–5 | `INPUT_PULLUP` — GPIO 5 is a strapping pin, do not hold that button while booting |
| GPIO 16 / 17 | Serial2 RX / TX | UART |

All four analogue inputs sit on **ADC1**. This is deliberate: ADC2 stops working
the moment Wi-Fi is active.

See section 3 for the strapping-pin resistors. They are not optional.

### ESP32 B — motion unit

| Pin | Component | Type |
|-----|-----------|------|
| GPIO 34 | IR left outer | ADC1 in |
| GPIO 35 | IR left inner | ADC1 in |
| GPIO 39 | IR right inner | ADC1 in |
| GPIO 36 | IR right outer | ADC1 in |
| GPIO 12 / 13 | Left motor RPWM / LPWM | PWM out — **GPIO 12 is a strapping pin, needs 10 kΩ pull-down** |
| GPIO 14 / 15 | Right motor RPWM / LPWM | PWM out — **GPIO 15 is a strapping pin, needs 10 kΩ pull-up** |
| GPIO 25 / 26 / 27 / 32 | Servo base / shoulder / elbow / wrist | PWM out |
| GPIO 16 / 17 | Serial2 RX / TX | UART |

---

## 2. Wiring precautions

### Strapping pins — do this before the first power-up

The ESP32 samples three pins at boot to decide how to start. If a driver or a
servo holds one of them at the wrong level, the board will look dead even though
nothing is broken.

| Pin | Board | What it does at boot | Fix |
|-----|-------|----------------------|-----|
| GPIO 12 (MTDI) | **both** | Selects the internal flash voltage. Held HIGH it picks 1.8 V, and a 3.3 V flash module will not boot at all. | 10 kΩ from the signal line to **GND** |
| GPIO 15 (MTDO) | **ESP32 B** | Held LOW it suppresses the boot log on the serial port. Not fatal, but it hides the messages you need while debugging. | 10 kΩ from the signal line to **3.3 V** |
| GPIO 5 | ESP32 A | Must be HIGH at boot. `INPUT_PULLUP` already handles it. | Do not hold pot button 4 while the board resets |

GPIO 15 on ESP32 A is the DHT22 data line, which already carries its own
4.7–10 kΩ pull-up, so nothing more is needed there.

**Alternative to all of the above:** keep the BTS7960 drivers and the servo rail
unpowered until the ESP32s have booted, using a separate switch on the motor
battery. Do this and the pins float to their safe defaults. The resistors are
still the more reliable answer because they do not depend on anyone remembering
the switching order.

### Relay lines

Add a 10 kΩ pull-up to 3.3 V on both relay control lines (GPIO 26 and GPIO 27 on
ESP32 A). The relays are active-LOW, and during reset or a watchdog restart the
ESP32's pins go high-impedance. Without the pull-up the relay input floats and a
pump can twitch on. With it, a reset is guaranteed to leave both pumps off.

### Grounds

The two LiPo packs must share a ground with each other and with both ESP32s.
Without a common reference the UART link between the boards will not work.

---

## 3. Bench-test switches

Five values depend on the physical robot rather than on the code. Each is a
single `#define` at the top of its sketch.

| Switch | Sketch | Default | Means |
|--------|--------|---------|-------|
| `CHECKPOINT_USES_INNER_SENSORS` | B | `0` | **Outer** pair detects checkpoints, **inner** pair follows the track — the physical Aqua-M V2 |
| `TRACK_LINE_WIDE` | B | `1` | Centred = both tracking sensors black. Set `0` if the line passes *between* them |
| `REVERSE_STEER_INVERT` | B | `0` | Reverse uses the same correction sign as forward |
| `MOTOR_DRIVER_DUAL_PWM` | B | `1` | BTS7960 native wiring. Set `0` for an L298N |
| `COOLDOWN_PER_POT` | A | `0` | One 2-minute cooldown shared by all pots. Set `1` for a cooldown per pot |

How to check the first two: put the robot on the track, print all four raw ADC
values, and push it forward by hand.

- The pair that goes black **only when crossing a perpendicular line** is the
  checkpoint pair.
- With the robot parked centred, if the tracking pair reads black/black set
  `TRACK_LINE_WIDE 1`; if it reads white/white set `TRACK_LINE_WIDE 0`.

In the straddled geometry (`TRACK_LINE_WIDE 0`) line-loss cannot be detected,
because both-white is also the normal centred state. The 45 s move timeout is
the safety net there instead of `ERROR:LINE_LOST`.

---

## 4. UART protocol

115200 baud, 8N1, plain text, one command per line terminated by `\n`.

**A → B**

| Command | Meaning |
|---------|---------|
| `TARGET:n` | Drive to pot *n* (1–5) |
| `PLANT` | Lower the arm, push the probe in |
| `LIFT` | Raise the arm |
| `IRRIGATE_ON` | Hold still, watering is starting |
| `IRRIGATE_OFF` | Watering finished |
| `STOP` | Emergency halt |
| `RETURN` | Go home to pot 1 |

**B → A**

| Status | Meaning |
|--------|---------|
| `MOVING` | Driving |
| `ARRIVED:n` | Parked at pot *n* |
| `SENSOR_READY` | Probe is in the soil |
| `LIFTED` | Arm is clear |
| `IDLE` | Waiting for orders |
| `ERROR:kind` | `LINE_LOST`, `MOVE_TIMEOUT`, `BAD_TARGET`, `BUSY` |

### The full handshake

```
A: TARGET:3
B: MOVING                         drives, counting checkpoint lines
B: ARRIVED:3                      stops
B:                                lowers the arm automatically
B: SENSOR_READY
A:                                waits 2 s for the probe to settle
A:                                reads soil, pH, DHT22, BH1750
A:                                asks Gemini, or falls back to the local rule
A: IRRIGATE_ON
A:                                runs the water pump, then the fertiliser pump
A: IRRIGATE_OFF
A: LIFT
B: LIFTED
B: IDLE
```

ESP32 A guards every wait with a timeout: 60 s for `ARRIVED`, 20 s for
`SENSOR_READY` and `LIFTED`. A timeout aborts the mission, lifts the arm and
returns to idle rather than hanging.

---

## 5. Decision logic

### Online — Gemini

`callGeminiAI()` posts to
`generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`
with a 15 s timeout and `responseMimeType: application/json`. It reads
`candidates[0].content.parts[0].text`, strips anything outside the outermost
`{ … }`, and parses:

```json
{ "pump_water": true, "water_duration": 8000,
  "pump_fertilizer": false, "fertilizer_duration": 0,
  "reason": "..." }
```

The firmware always has the last word: durations are clamped to 0–10000 ms
(water) and 0–5000 ms (fertiliser) after parsing, no matter what the model
returns.

Any timeout, HTTP 429, missing text part or unparseable JSON clears
`aiAvailable` and drops through to the local rule. The flag is set again on the
next successful connectivity check.

### Offline — local rule

| Soil moisture | Water pump |
|---------------|-----------|
| < 30 % | 8 s |
| 30–60 % | 4 s |
| > 60 % | off |

Air temperature above 35 °C adds 2 s. The result is clamped to 10 s.

**Fertilising has no local rule.** When the AI is unavailable, fertilising is
marked `fertilizer_deferred` and skipped. Guessing a nutrient dose from a
moisture reading would be worse than doing nothing.

### Guards applied to both paths

Two guards run after the decision, whichever path produced it. Both of them
stop **both pumps**, not just the water pump.

| Guard | Effect |
|-------|--------|
| Cooldown not elapsed | Water and fertiliser both held. Fertiliser is marked `fertilizer_deferred`, so it can be applied on the next visit rather than being lost. |
| Soil probe outside 700–3800 ADC | Nothing is applied. A nutrient dose chosen from a reading we do not trust is worse than no dose. |

**Why the cooldown covers fertiliser.** Liquid fertiliser is still liquid going
into the same pot. Letting up to 5 s of it through while the firmware has just
decided the medium was too recently wetted would defeat the point of the
cooldown. The fertiliser pump also has no cooldown of its own, so without this
guard nothing would space fertiliser applications out at all.

**Scope of the cooldown.** With `COOLDOWN_PER_POT 0` (the default) there is one
2-minute cooldown shared by every pot: water pot 1, and pots 2–5 are held for
the next two minutes. Set the switch to `1` for an independent cooldown per pot.
See `RECOMMENDATIONS.md` item 23 — this decides whether a full sweep can water
more than one plant, so agree on it as a team before the demo.

---

## 6. Calibration

**Soil moisture** — two points: 3200 ADC dry, 1075 ADC wet.
`map(raw, 3200, 1075, 0, 100)`, constrained to 0–100. Raw values outside
700–3800 mean a shorted or disconnected probe; the firmware then reports 50 %
and refuses to irrigate.

**pH** — two points: ADC 2200 at pH 4.0, ADC 1500 at pH 9.0.

```
pH = 4.0 + 5.0 * (raw - 2200) / (1500 - 2200)
```

Readings outside 3.5–9.0 are flagged invalid and never reach the AI prompt.

**DHT22** — on `NaN`, the last good reading is kept. If there has never been
one, 28 °C and 60 % RH are used.

**IR threshold** — `IR_THRESHOLD` is 2000 by default. Print `analogRead()` for
each of the four sensors over the black line and over the floor, then set the
threshold midway between the two. Do this at the light level you will run the
demo in; TCRT5000 readings shift noticeably under bright stage lighting.

While you have the readings on screen, settle `CHECKPOINT_USES_INNER_SENSORS`
and `TRACK_LINE_WIDE` at the same time — section 3 explains how.

---

## 7. Safety

| Guard | Where |
|-------|-------|
| Relays driven HIGH in `setup()` before anything else | ESP32 A |
| Active-LOW relays: pumps open on reset or brown-out | hardware |
| `enforceActuatorSafety()` runs every loop and can only turn pumps **off** | ESP32 A |
| No network call while a pump is running | state machine |
| 2-minute cooldown, 10 s water ceiling, 5 s fertiliser ceiling | ESP32 A |
| Line-lost detection stops the motors after 2.5 s | ESP32 B |
| Move timeout stops the motors after 45 s | ESP32 B |
| Task watchdog resets the board if the loop stalls | both |
| 10 kΩ pull-ups on the relay lines keep pumps off during reset | hardware |

**Watchdog timeouts.** ESP32 A uses 30 s, ESP32 B uses 8 s. The difference is
deliberate: a single loop iteration on ESP32 A can legitimately block for 15 s
inside the Gemini POST, so a short timeout would reset the board every time the
API was slow. ESP32 B never blocks, so 8 s is ample there. Both feed the dog at
the top of `loop()` and both are configured to panic-reset on expiry.

The blocking-call row is the important one. Gemini and Firebase calls block for up to
15 seconds. The mission state machine only issues them in `ST_IDLE` and
`ST_DECIDE`, where both pumps are off by construction, so a slow API can never
extend a watering cycle.

---

## 8. Firebase schema

```
/device/esp32_a/
  sensors/      soil_moisture, temperature, humidity, pH, light_intensity, timestamp
  weather/      condition, temp_out, humidity_out, timestamp
  ai_decision/  pump_water, water_duration, pump_fertilizer, fertilizer_duration,
                fertilizer_deferred, reason, timestamp
  status/       mode, pump_active, internet, ai_available, decision_source,
                mission_state, dht_fault, soil_fault
  command/      target_pot, action        <- written by the dashboard
/device/esp32_b/
  status/       current_pot, moving, connection, error
```

`pH` is written as `-1` when the probe reading was invalid.

`dht_fault` and `soil_fault` are reported separately so the dashboard can name
the sensor at fault rather than showing a single unhelpful error light. The red
LED on the robot is the OR of the two.

**Why `soil_fault` is only judged mid-mission.** The moisture probe rides on the
arm. It reads a valid value only while the arm has planted it in soil; between
missions the arm is raised and the probe dangles in air, where it always reads
out of range. That is the normal resting state, not a fault, so the firmware
only evaluates the probe while `probeIsPlanted()` is true — that is, from
`ST_SETTLE` through `ST_IRRIGATE_OFF`. Judging it outside that window would
leave the red LED on permanently and make it meaningless.

The DHT22 is wired in permanently, so `dht_fault` is judged at all times.
The pH probe is deliberately in neither flag: an out-of-range pH is handled by
not sending the value to the AI, which does not stop irrigation and does not
deserve an error light.

ESP32 B has no Wi-Fi. Its status arrives at ESP32 A over UART, and A mirrors it
into `/device/esp32_b/status`.

Firebase is a logbook and a mailbox. It never sits between the ESP32 and the AI:
the Gemini call is a direct HTTPS POST from the board.

Suggested database rules while developing:

```json
{
  "rules": {
    "device": {
      ".read": true,
      ".write": true
    }
  }
}
```

Tighten these before any public demo — see `RECOMMENDATIONS.md`, item 5.

---

## 9. Function reference

### ESP32 A

| Function | Does |
|----------|------|
| `readSoil` / `readPH` / `readDHT` / `readLight` | One sensor each, with its own validity rule |
| `taskSolarTracker` | Compares the two LDRs, steps the servo 1° with a 5 % deadband |
| `taskConnectivity` | Every 30 s: Wi-Fi + Firebase check, LED update, re-arms `aiAvailable` |
| `fetchWeather` | wttr.in compact format, split on `\|` |
| `parseNumber` | Strips every character that cannot be part of a number, so the degree symbol and unit letters cannot break `toFloat()` |
| `probeIsPlanted` | True from `ST_SETTLE` to `ST_IRRIGATE_OFF` — the window where the soil probe is actually in soil |
| `activePot` / `cooldownElapsed` | Cooldown lookup, global or per pot depending on `COOLDOWN_PER_POT` |
| `watchdogBegin` | Task watchdog, 30 s, panic-reset |
| `buildPrompt` / `callGeminiAI` | Builds the prompt, posts it, parses the reply |
| `localThresholdDecision` | The offline rule |
| `makeDecision` | Picks a path, then applies the cooldown and probe-validity guards |
| `runMission` | The 13-state mission machine |
| `enforceActuatorSafety` | Unconditional pump watchdog |
| `pollFirebaseCommand` | Reads `target_pot` and `action` from the dashboard |
| `handleUartLine` | Turns a status line from B into a state transition |

### ESP32 B

| Function | Does |
|----------|------|
| `readTrackError` | −1 / 0 / +1 / 2 (lost) from the two tracking sensors |
| `checkpointReached` | Edge-triggered: 50 ms on black, then 150 ms clear before it can fire again |
| `navigationUpdate` | Steering, checkpoint counting, line-loss and timeout supervision |
| `motorWrite` / `driveMotors` | Signed −255…+255 per side, either wiring mode |
| `armStart` / `armUpdate` | Non-blocking waypoint player, 1° per 15 ms |
| `handleCommand` | The A → B command table |
| `watchdogBegin` | Task watchdog, 8 s, panic-reset |

---

## 10. Build and flash

**Firmware.** Arduino IDE, board *ESP32 Dev Module*, partition scheme
*Huge APP (3MB No OTA/1MB SPIFFS)*. Libraries: ESP32Servo, FirebaseESP32
(Mobizt), ArduinoJson 6 or 7, DHT sensor library (Adafruit), BH1750
(Christopher Laws), LiquidCrystal_I2C (Frank de Brabander).

### Verified toolchain

Both sketches were compiled against every combination below on 2026-09-08.
All eleven passed. Pin these versions if a future build misbehaves — "some
version of the ESP32 core" is what costs an evening on a deadline.

| Component | Versions verified |
|-----------|-------------------|
| arduino-cli | 1.2.0 (the copy bundled in Arduino IDE 2 works; no separate install needed) |
| `esp32:esp32` core | **2.0.17** and **3.3.11** — both build cleanly |
| ArduinoJson | **6.21.5** and **7.4.3** — the `JSON_DOC` macro in A §3 bridges them correctly |
| Firebase ESP32 Client (Mobizt) | **4.4.17** — the 4.x line, header `FirebaseESP32.h`. Not the newer *Firebase Arduino Client Library*, which uses a different API |
| ESP32Servo | 3.2.1 |
| DHT sensor library (Adafruit) | 1.4.7 |
| Adafruit Unified Sensor | 1.1.15 |
| BH1750 (Christopher Laws) | 1.3.0 |
| LiquidCrystal I2C | 1.1.2 |

Flash and RAM, `huge_app` partition (3 145 728 B flash, 327 680 B RAM):

| Sketch | Core | Flash | RAM |
|--------|------|-------|-----|
| A | 2.0.17 | 1 256 161 B (40 %) | 50 596 B (15 %) |
| A | 3.3.11 | 1 401 466 B (44 %) | 53 536 B (16 %) |
| B | 2.0.17 | 286 625 B (9 %) | 22 204 B (6 %) |
| B | 3.3.11 | 298 591 B (9 %) | 22 912 B (6 %) |

Core 3.x costs ESP32 A about 145 kB more flash than 2.0.17. Both fit with wide
headroom, so either core is a safe choice.

Reproduce the whole matrix with `bash tools/build_matrix.sh`. The five
bench-test switches are `#ifndef`-guarded, so the script can compile both
branches of each without editing any source file:

```bash
arduino-cli compile --fqbn "esp32:esp32:esp32:PartitionScheme=huge_app" \
  --build-property "compiler.cpp.extra_flags=-DTRACK_LINE_WIDE=0" \
  firmware/AquaM_ESP32_B
```

**A note on the Windows setup used here.** If the Arduino sketchbook sits inside
OneDrive, library installs fail while extracting (`creating temp dir ...: The
system cannot find the file specified`). Point the sketchbook somewhere outside
OneDrive, or set `ARDUINO_DIRECTORIES_USER`, and it works.

Fill in the block marked *USER CONFIGURATION* at the top of
`AquaM_ESP32_A.ino` first: Wi-Fi, Firebase URL and secret, Gemini key, and the
wttr.in location.

If the LCD stays blank, change `LCD_I2C_ADDRESS` from `0x27` to `0x3F`.

Fit the strapping-pin resistors from section 2 before the first power-up. A
board that will not boot because GPIO 12 was pulled high looks exactly like a
dead board, and you can lose an afternoon to it.

**Driving advice.** Prefer forward moves. Reverse line following is the weakest
part of the system — the sensor bar is at the front, so it trails the robot when
reversing and the correction loop is unstable for either sign of the switch.
Section 15 of `AquaM_ESP32_B.ino` works through why. Over one pot's distance it
holds; over several it wanders. A sweep of 1 → 2 → 3 → 4 → 5 followed by a
single reverse run home is more reliable than hopping back and forth.

**Website.**

```bash
cd website
cp .env.example .env      # fill in the Firebase web config
npm install
npm run dev               # http://localhost:5173
npm run build             # dist/ — deploy to Firebase Hosting, Vercel or Netlify
```

---

## 11. BenchTest — how to read the output

`tools/BenchTest/BenchTest.ino` is a wiring and calibration aid, separate from
the robot firmware. Flash it to one board at a time and open the Serial Monitor
at **115200 baud**. It streams raw ADC values every 200 ms and takes single-key
commands. Press `h` for the menu.

Pick the board at the top of the file:

```c
#define BENCH_BOARD_A 1     // 1 = ESP32 A, 0 = ESP32 B
```

### ESP32 A columns

```
ms      soil    pH      ldrL    ldrR    water   fert
41200   3187    2204    1841    1902    off     off
```

- **soil** — raw ADC from the capacitive probe. Compare against the calibration
  in §3: 3200 is the dry reference, 1075 the wet one. Hold the probe in air, then
  in a glass of water. If air does not read near 3200 and water near 1075, the
  numbers in §3 need replacing with what you actually measure.
- **pH** — raw ADC. `PH_ADC_AT_4` (2200) and `PH_ADC_AT_9` (1500) are
  placeholders, see RECOMMENDATIONS item 20. Read a pH 4 buffer and a pH 9
  buffer, write down both numbers, and put them in §3.
- **ldrL / ldrR** — solar tracker. Shade one side and confirm the two columns
  move apart. If they move together, they are wired to the same node.
- **water / fert** — relay state. `w` and `f` toggle them, `0` turns both off.
  Listen for the click, and watch that neither turns on by itself at boot.

### ESP32 B columns

```
ms      irLout  irLin   irRin   irRout  L_out  L_in  R_in  R_out
41200   2612    1104    1180    2588    BLK    wht   wht   BLK
```

The last four columns apply `IR_THRESHOLD` (2000) to the raw values, so you can
read the verdict directly. This is what resolves the two open switch questions
in RECOMMENDATIONS section A:

**`CHECKPOINT_USES_INNER_SENSORS`.** Push the robot along the track by hand and
watch which pair flips to `BLK` *only* while crossing a perpendicular line. That
pair is the checkpoint pair. If it is the outer pair, the default `0` is right.

**`TRACK_LINE_WIDE`.** Park the robot centred on the track and read the two
tracking sensors:

| Both tracking sensors read | Meaning | Set |
|----------------------------|---------|-----|
| `BLK BLK` | the line covers both — wide line | `TRACK_LINE_WIDE 1` (default) |
| `wht wht` | the line passes between them — straddled | `TRACK_LINE_WIDE 0` |

Get this wrong in the wide direction and the robot reports `ERROR:LINE_LOST`
within 2.5 s of a perfectly normal start.

While you are here, note the actual black and white values. If they are not
separated by a comfortable margin either side of 2000, adjust the sensor height
before adjusting `IR_THRESHOLD` — height is the stronger lever.

`1`–`4` sweep the four arm servos one at a time, `a` sweeps all four. The sweep
is deliberately limited to 60–120° rather than full travel: this is a wiring
check, and an arm with the probe fitted can hit the frame at an unexpected
angle. **The motors are not driven by this sketch on purpose** — a bench test
that can make the robot move is a bench test that drives itself off the table.

`space` pauses the stream so you can read a value without it scrolling away.

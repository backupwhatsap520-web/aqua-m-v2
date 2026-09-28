# Aqua-M V2

AI-Driven Hybrid Mobile Smart Irrigation Robot — firmware, dashboard and docs.

A rail-guided robot drives between five pots, pushes a probe into the soil at
each one, asks Gemini what the plant needs, and waters it. When the network is
down it falls back to a rule that runs entirely on the board, so the plants still
get water.

```
aqua-m-v2/
├── README.md                 you are here
├── DOCUMENTATION.md          pin maps, protocol, calibration, Firebase schema
├── FLOWCHARTS.md             Mermaid diagrams for the paper and the poster
├── RECOMMENDATIONS.md        design review — read section A first
├── firmware/
│   ├── AquaM_ESP32_A/        control hub: sensors, pumps, AI, Firebase, solar
│   └── AquaM_ESP32_B/        motion unit: line following, checkpoints, arm
├── website/                  React + TypeScript dashboard
└── analysis/                 standalone: Monte Carlo on graduate demand and
                              robotics careers in Indonesia, 2026-2036
```

## Before you power anything up

Three resistors. They are not optional, and a board that fails one of these
looks exactly like a dead board.

| Pin | Board | Fit |
|-----|-------|-----|
| GPIO 12 | **both** | 10 kΩ to **GND**. Held high at boot, the ESP32 picks the wrong flash voltage and will not start. |
| GPIO 15 | **ESP32 B** | 10 kΩ to **3.3 V**. Held low it hides the boot log you need for debugging. |
| GPIO 26, 27 | ESP32 A | 10 kΩ to **3.3 V** on both relay lines, so a reset cannot twitch a pump on. |

If you would rather not add resistors: keep the motor drivers and the servo rail
unpowered until both ESP32s have booted. The resistors are more reliable because
they do not depend on anyone remembering the switching order.

Both LiPo packs must share a ground with each other and with both boards, or the
UART link between them will not work.

## Start here

1. Fit the resistors above.
2. **Read `RECOMMENDATIONS.md` section A.** Two things need a decision before a
   long run: the cooldown scope, and how the robot behaves in reverse.
3. Set the five bench-test switches — `DOCUMENTATION.md` section 3 explains how
   to check each one in about ten minutes with a serial monitor.
4. Fill in the *USER CONFIGURATION* block at the top of `AquaM_ESP32_A.ino`.
5. Flash both sketches with the *Huge APP (3MB No OTA)* partition scheme.
6. `cd website && cp .env.example .env && npm install && npm run dev`

## The short version of how it works

ESP32 A holds every sensor and both pumps. ESP32 B holds the wheels and the arm.
They talk over UART at 115200, which keeps working with the Wi-Fi off.

ESP32 A sends `TARGET:3`. ESP32 B drives there with its **inner** infrared pair
following the track and its **outer** pair counting the perpendicular checkpoint
lines that mark each pot. It parks, lowers the arm and reports `SENSOR_READY`.
ESP32 A reads the soil, asks Gemini, runs the pump for the time it decides, then
sends `LIFT`.

Prefer forward moves. Reverse line following is the weak point — the sensors sit
at the front, so they trail the robot when it reverses. It holds over one pot's
distance and wanders over several.

If Gemini cannot be reached, a local rule waters based on soil moisture alone.
Fertilising has no local rule on purpose — it is deferred until the AI is back,
because guessing a nutrient dose from a moisture reading is worse than waiting.

Firebase is a logbook and a mailbox. The AI call is a direct HTTPS POST from the
board; nothing routes through the database.

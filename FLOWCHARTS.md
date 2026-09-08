# Aqua-M V2 — Flowcharts

Mermaid diagrams. They render on GitHub as-is; for the paper or a poster, paste
any block into <https://mermaid.live> and export SVG or PNG.

---

## 1. System overview

```mermaid
flowchart LR
  subgraph A["ESP32 A — control hub"]
    S1[Soil moisture]
    S2[pH probe]
    S3[DHT22]
    S4[BH1750]
    S5[2x LDR]
    R1[Relay 1 - water pump]
    R2[Relay 2 - fertiliser pump]
    SV[Solar tracker servo]
  end

  subgraph B["ESP32 B — motion unit"]
    IR["4x TCRT5000 - inner pair tracks, outer pair counts checkpoints"]
    MOT[2x BTS7960 + DC motors]
    ARM[4x servo arm]
  end

  S1 --> A
  S2 --> A
  S3 --> A
  S4 --> A
  S5 --> A
  A --> R1
  A --> R2
  A --> SV

  A <-->|UART 115200| B
  B --> MOT
  B --> ARM
  IR --> B

  A -->|HTTPS POST| G[Google AI Studio - Gemini]
  A -->|HTTPS GET| W[wttr.in]
  A -->|log + command| F[(Firebase RTDB)]
  F <--> D[React dashboard]
```

Note the shape of it: the AI call is a direct edge from ESP32 A to Gemini.
Firebase never sits in that path.

---

## 2. Mission state machine — ESP32 A

```mermaid
stateDiagram-v2
  [*] --> ST_IDLE
  ST_IDLE --> ST_MOVE_REQUEST : button pressed or target_pot written
  ST_MOVE_REQUEST --> ST_WAIT_ARRIVE : send TARGET n
  ST_WAIT_ARRIVE --> ST_WAIT_SENSOR : ARRIVED n
  ST_WAIT_ARRIVE --> ST_IDLE : timeout 60 s
  ST_WAIT_SENSOR --> ST_SETTLE : SENSOR_READY
  ST_WAIT_SENSOR --> ST_IDLE : timeout 20 s
  ST_SETTLE --> ST_READ : after 2 s
  ST_READ --> ST_DECIDE
  ST_DECIDE --> ST_IRRIGATE_ON
  ST_IRRIGATE_ON --> ST_LIFT : nothing to apply
  ST_IRRIGATE_ON --> ST_IRRIGATE_RUN : pump started
  ST_IRRIGATE_RUN --> ST_IRRIGATE_RUN : water done, fertiliser next
  ST_IRRIGATE_RUN --> ST_IRRIGATE_OFF : all phases done
  ST_IRRIGATE_OFF --> ST_LIFT
  ST_LIFT --> ST_WAIT_LIFTED
  ST_WAIT_LIFTED --> ST_FINISH : LIFTED
  ST_WAIT_LIFTED --> ST_IDLE : timeout 20 s
  ST_FINISH --> ST_IDLE
```

Network work happens only in `ST_IDLE` and `ST_DECIDE`. Pumps only run in
`ST_IRRIGATE_RUN`. The two sets never overlap, so a slow API call cannot stretch
a watering cycle.

---

## 3. Irrigation decision

```mermaid
flowchart TD
  START([Probe planted, sensors read]) --> ONLINE{Wi-Fi + Firebase up<br/>and aiAvailable?}
  ONLINE -->|no| LOCAL[Local threshold rule]
  ONLINE -->|yes| CALL[POST to Gemini, 15 s timeout]
  CALL --> OK{Valid JSON back?}
  OK -->|no| CLEAR[Clear aiAvailable] --> LOCAL
  OK -->|yes| PARSE[Read pump_water, water_duration,<br/>pump_fertilizer, fertilizer_duration]
  PARSE --> CLAMP[Clamp: water 0-10000 ms<br/>fertiliser 0-5000 ms]
  LOCAL --> LRULE["&lt;30 percent: 8 s<br/>30-60 percent: 4 s<br/>&gt;60 percent: off<br/>above 35 C: +2 s<br/>fertiliser deferred"]
  CLAMP --> GUARD
  LRULE --> GUARD{Cooldown elapsed<br/>and probe valid?}
  GUARD -->|no| SKIP[Hold BOTH pumps, defer fertiliser, log the reason]
  GUARD -->|yes| RUN[Run pumps, water first then fertiliser]
  SKIP --> LOG[(Write to Firebase)]
  RUN --> LOG
```

---

## 4. Navigation — ESP32 B

```mermaid
flowchart TD
  CMD([TARGET n received]) --> SAME{n equals currentPot?}
  SAME -->|yes| ARR[Reply ARRIVED n] --> PLANT
  SAME -->|no| DIR[Forward if n greater than currentPot,<br/>otherwise reverse] --> MOVE[Reply MOVING]
  MOVE --> TRACK[Read the two INNER sensors - line tracking]
  TRACK --> ERR{Track error}
  ERR -->|centred| STRAIGHT[Both wheels at cruise speed]
  ERR -->|drifted| CORR[Slow the inner wheel]
  ERR -->|line lost| SEARCH[Sweep toward the last known edge]
  SEARCH --> LOST{Lost for more than 2.5 s?}
  LOST -->|yes| ERRSTOP[Stop, reply ERROR LINE_LOST]
  LOST -->|no| CP
  STRAIGHT --> CP
  CORR --> CP
  CP{Both OUTER sensors<br/>on black for 50 ms?}
  CP -->|no| TRACK
  CP -->|yes| COUNT[currentPot plus or minus 1]
  COUNT --> DONE{currentPot equals target?}
  DONE -->|no| CLEARLINE[Wait 150 ms for the line to clear] --> TRACK
  DONE -->|yes| STOP[Stop, reply ARRIVED n] --> PLANT
  PLANT([Lower the arm])
```

Sensor roles: the **inner** pair follows the track, the **outer** pair detects
the perpendicular checkpoint lines. The outer pair sits off the track and only
reads black at a crossing, which is what makes the count reliable.

The 150 ms clear-window is what stops one thick line being counted several
times as the robot rolls over it.

Reverse moves use the same diagram, but see section 15 of `AquaM_ESP32_B.ino`:
with the sensor bar at the front, the correction loop is unstable in reverse.

---

## 5. Arm sequence

```mermaid
sequenceDiagram
  participant A as ESP32 A
  participant B as ESP32 B
  participant SV as 4 servos

  B->>SV: HOME to OVER_POT, 1 degree per 15 ms
  B->>SV: OVER_POT to PLANTED
  B->>A: SENSOR_READY
  A->>A: settle 2 s, then read soil, pH, DHT22, BH1750
  A->>A: decide (Gemini or local rule)
  A->>B: IRRIGATE_ON
  A->>A: water pump for the decided duration
  A->>A: fertiliser pump, if the AI asked for it
  A->>B: IRRIGATE_OFF
  A->>B: LIFT
  B->>SV: PLANTED to OVER_POT to HOME
  B->>A: LIFTED
  B->>A: IDLE
```

---

## 6. Power distribution

```mermaid
flowchart LR
  BAT1[LiPo 3S 11.1 V - battery 1] --> SH1[Shield board A] --> ESPA[ESP32 A + sensors + LCD + relays]
  BAT2[LiPo 3S 11.1 V - battery 2] --> BTS[2x BTS7960]
  BAT2 --> UBEC[UBEC 5 V 5 A] --> SERVOS[4x arm servo]
  BTS --> SH2[Shield board B]
  UBEC --> SH2
  SH2 --> ESPB[ESP32 B]
  BTS --> MOTORS[2x DC motor]
  GND[Common ground across both batteries]
  BAT1 -.-> GND
  BAT2 -.-> GND
```

Two batteries, one per ESP32, so motor and servo current cannot brown out the
logic. The grounds are still tied together — without a shared reference the UART
link between the two boards will not work.

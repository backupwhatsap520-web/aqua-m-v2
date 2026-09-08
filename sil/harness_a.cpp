/* ===========================================================================
 *  Aqua-M V2 — SIL harness for ESP32 A
 *
 *  SOFTWARE-IN-THE-LOOP ONLY. Every number this produces comes from simulated
 *  inputs on a host PC. Nothing here has touched an ESP32, a pump or a plant.
 *
 *  The real sketch is included directly (§7.1) so this can never drift out of
 *  date against a copy.
 * ======================================================================== */
#include "stubs/arduino_stub_prelude.h"
#include "stubs/sil_net.h"
#include "stubs/FirebaseESP32.h"

#include "../firmware/AquaM_ESP32_A/AquaM_ESP32_A.ino"

#include <cstdio>
#include <string>
#include <vector>

/* --- tiny test framework ------------------------------------------------- */
static int g_pass = 0, g_fail = 0;
static std::vector<std::string> g_failures;

static void ck(bool cond, const std::string &what) {
  if (cond) { g_pass++; }
  else { g_fail++; g_failures.push_back(what); std::printf("    FAIL  %s\n", what.c_str()); }
}

static void ckEqI(long got, long want, const std::string &what) {
  if (got == want) g_pass++;
  else {
    g_fail++;
    char b[400];
    std::snprintf(b, sizeof(b), "%s (got %ld, want %ld)", what.c_str(), got, want);
    g_failures.push_back(b);
    std::printf("    FAIL  %s\n", b);
  }
}

static void ckNear(float got, float want, float tol, const std::string &what) {
  if (std::fabs(got - want) <= tol) g_pass++;
  else {
    g_fail++;
    char b[400];
    std::snprintf(b, sizeof(b), "%s (got %.3f, want %.3f +/- %.3f)", what.c_str(), got, want, tol);
    g_failures.push_back(b);
    std::printf("    FAIL  %s\n", b);
  }
}

/* --- harness helpers ----------------------------------------------------- */

/*  Put the firmware's globals back to a known state between scenarios. The
 *  sketch has no reset entry point, so this sets what the tests depend on. */
static void resetFirmware() {
  sil::resetPins();
  sil::resetSerial();
  sil::net::reset();
  sil::fb::reset();
  sil::setClock(10000);          // not 0: exercises the "sentinel 0" question
  sil::dhtTemp = 28.0f;
  sil::dhtHum  = 60.0f;
  sil::lux     = 500.0f;

  waterPumpOn = false;
  fertPumpOn  = false;
  pumpEndMs   = 0;
  lastPumpStop = 0;
  onlineMode  = false;
  aiAvailable = false;
  mission     = ST_IDLE;
  targetPot   = 0;
  robotCurrentPot = 1;
  soilFault   = false;

  sensors.soilPercent = 50.0f; sensors.soilValid = false;
  sensors.pH = 7.0f;           sensors.phValid   = false;
  sensors.temperature = 28.0f; sensors.humidity  = 60.0f; sensors.dhtValid = true;
  sensors.lux = 500.0f;        sensors.luxValid  = true;

  decision.pumpWater = false;  decision.waterDuration = 0;
  decision.pumpFertilizer = false; decision.fertDuration = 0;
  decision.fertilizerDeferred = false;
  decision.source = "NONE";

  /*  Relays idle: both HIGH, because they are active-LOW. */
  digitalWrite(PIN_RELAY_WATER, HIGH);
  digitalWrite(PIN_RELAY_FERT,  HIGH);
  sil::pinTrace.clear();
}

/* ===========================================================================
 *  §7.3 Known-answer tests — validate the harness before anything else.
 *  If these disagree, the harness is wrong, not the firmware.
 * ======================================================================== */
static void knownAnswers() {
  std::printf("\n[1] Known-answer table (brief 7.3)\n");

  struct SoilCase { int adc; int pct; bool valid; const char *name; };
  const SoilCase soil[] = {
    {3200,   0, true,  "soil ADC 3200 -> 0%"},
    {1075, 100, true,  "soil ADC 1075 -> 100%"},
    {2137,  50, true,  "soil ADC 2137 (midpoint) -> ~50%"},
    {500,   50, false, "soil ADC 500 -> invalid, 50% fallback"},
    {4000,  50, false, "soil ADC 4000 -> invalid, 50% fallback"},
  };
  for (const auto &c : soil) {
    resetFirmware();
    sil::setAnalog(PIN_SOIL, c.adc);
    readSoil();
    ckEqI((long)sensors.soilPercent, c.pct, c.name);
    ck(sensors.soilValid == c.valid, std::string(c.name) + " (soilValid)");
  }

  struct PhCase { int adc; float ph; bool valid; const char *name; };
  const PhCase ph[] = {
    {2200, 4.00f, true,  "pH ADC 2200 -> 4.00"},
    {1500, 9.00f, true,  "pH ADC 1500 -> 9.00"},
    {1850, 6.50f, true,  "pH ADC 1850 -> ~6.50"},
    {2500, 0.00f, false, "pH ADC 2500 -> invalid"},
  };
  for (const auto &c : ph) {
    resetFirmware();
    sil::setAnalog(PIN_PH, c.adc);
    readPH();
    ck(sensors.phValid == c.valid, std::string(c.name) + " (phValid)");
    if (c.valid) ckNear(sensors.pH, c.ph, 0.02f, c.name);
  }

  struct RuleCase { float soilPct; float tempC; unsigned long ms; const char *name; };
  const RuleCase rules[] = {
    {25.0f, 30.0f, 8000UL, "soil 25%, 30C -> 8000 ms"},
    {45.0f, 30.0f, 4000UL, "soil 45%, 30C -> 4000 ms"},
    {45.0f, 38.0f, 6000UL, "soil 45%, 38C -> 6000 ms (heat bonus)"},
    {70.0f, 40.0f,      0UL, "soil 70%, 40C -> off"},
  };
  for (const auto &c : rules) {
    resetFirmware();
    sensors.soilPercent = c.soilPct;
    sensors.soilValid   = true;
    sensors.temperature = c.tempC;
    localThresholdDecision();
    ckEqI((long)decision.waterDuration, (long)c.ms, c.name);
  }
}

/* ===========================================================================
 *  §7.4 invariant 1 — no network call while a pump is running.
 *  The single most important invariant in the codebase.
 * ======================================================================== */
static void invariant1_noNetworkWhilePumping() {
  std::printf("\n[2] Invariant 1: no network call while a pump runs\n");

  resetFirmware();

  std::vector<std::string> violations;
  std::vector<int>         pumpOnStates;   // mission states seen with a pump on
  sil::net::guard = [&violations](const char *where) {
    if (waterPumpOn || fertPumpOn) violations.push_back(where);
  };

  onlineMode  = true;
  aiAvailable = true;
  sil::setAnalog(PIN_SOIL, 3000);            // dry: the AI path will water
  sensors.soilPercent = 15.0f; sensors.soilValid = true;

  /*  The AI asks for the full 10 s, and the reply itself costs 12 s of virtual
   *  time — a slow call, which is exactly the case the invariant guards. */
  sil::net::queuePost(200,
      R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":10000,\"fertilizer_duration_ms\":4000,\"reason\":\"sil\"}"}]}}]})",
      12000);

  /*  Drive a real mission end to end, playing the part of ESP32 B. */
  startMission(2);

  bool sentArrived = false, sentReady = false, sentLifted = false;
  for (int i = 0; i < 600 && mission != ST_IDLE; i++) {
    loop();

    if (waterPumpOn || fertPumpOn) pumpOnStates.push_back((int)mission);

    /*  Reply to whatever the firmware just asked ESP32 B to do. */
    if (!sentArrived && sil::uartTx.find("TARGET:2") != std::string::npos) {
      sil::feedUart("MOVING\nARRIVED:2\n"); sentArrived = true;
    } else if (sentArrived && !sentReady &&
               sil::uartTx.find("IRRIGATE_ON") == std::string::npos) {
      sil::feedUart("SENSOR_READY\n"); sentReady = true;
    } else if (!sentLifted && sil::uartTx.find("LIFT") != std::string::npos) {
      sil::feedUart("LIFTED\n"); sentLifted = true;
    }

    sil::advance(100);
  }

  ck(mission == ST_IDLE, "the driven mission ran to completion and returned to idle");
  ck(!pumpOnStates.empty(), "the mission actually ran a pump (otherwise the test proves nothing)");

  ck(violations.empty(),
     std::string("no network entry point was reached while a pump was on")
     + (violations.empty() ? "" : std::string(" [first: ") + violations[0] + "]"));

  /*  The structural reason the invariant holds: loop() confines all network
   *  work to ST_IDLE, so a pump running in any other state cannot collide with
   *  it. Assert that pumps are never on while the machine is idle. */
  bool idleWithPump = false;
  for (int s : pumpOnStates) if (s == (int)ST_IDLE) idleWithPump = true;
  ck(!idleWithPump, "a pump is never on while the mission state is ST_IDLE");

  sil::net::guard = [](const char *) {};
}

/* ===========================================================================
 *  §7.4 invariant 2 — both relays off at reset and after every abort.
 * ======================================================================== */
static void invariant2_safeReset() {
  std::printf("\n[3] Invariant 2: pumps off at reset and after abort\n");

  resetFirmware();
  waterPumpOn = true; fertPumpOn = true;
  digitalWrite(PIN_RELAY_WATER, LOW);
  digitalWrite(PIN_RELAY_FERT,  LOW);

  abortMission("sil: forced abort");

  ckEqI(sil::levelOf(PIN_RELAY_WATER), HIGH, "water relay HIGH (off) after abort");
  ckEqI(sil::levelOf(PIN_RELAY_FERT),  HIGH, "fert relay HIGH (off) after abort");
  ck(!waterPumpOn, "waterPumpOn cleared after abort");
  ck(!fertPumpOn,  "fertPumpOn cleared after abort");
  ck(mission == ST_IDLE, "state machine returns to ST_IDLE after abort");

  /*  allPumpsOff() must be idempotent and safe from any state. */
  resetFirmware();
  allPumpsOff();
  ckEqI(sil::levelOf(PIN_RELAY_WATER), HIGH, "water relay off after allPumpsOff");
  ckEqI(sil::levelOf(PIN_RELAY_FERT),  HIGH, "fert relay off after allPumpsOff");
}

/* ===========================================================================
 *  §7.4 invariant 3 — durations are clamped whatever the AI returns.
 *  Fed with the hostile responses the brief lists.
 * ======================================================================== */
static void invariant3_durationClamp() {
  std::printf("\n[4] Invariant 3: AI duration clamping against hostile replies\n");

  struct Hostile { const char *name; int code; const char *body; uint32_t latency; };
  const Hostile cases[] = {
    {"huge water duration",   200, R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":999999,\"fertilizer_duration_ms\":999999,\"reason\":\"x\"}"}]}}]})", 0},
    {"negative durations",    200, R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":-5000,\"fertilizer_duration_ms\":-1,\"reason\":\"x\"}"}]}}]})", 0},
    {"null where int belongs",200, R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":null,\"reason\":\"x\"}"}]}}]})", 0},
    {"string where int belongs",200,R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":\"lots\",\"reason\":\"x\"}"}]}}]})", 0},
    {"float duration",        200, R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":8000.7,\"reason\":\"x\"}"}]}}]})", 0},
    {"missing keys",          200, R"({"candidates":[{"content":{"parts":[{"text":"{\"reason\":\"nothing else\"}"}]}}]})", 0},
    {"json in code fences",   200, R"({"candidates":[{"content":{"parts":[{"text":"```json\n{\"water_duration_ms\":4000,\"reason\":\"x\"}\n```"}]}}]})", 0},
    {"prose before json",     200, R"({"candidates":[{"content":{"parts":[{"text":"Sure! Here you go: {\"water_duration_ms\":4000,\"reason\":\"x\"}"}]}}]})", 0},
    {"truncated response",    200, R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":40")", 0},
    {"empty body",            200, "", 0},
    {"HTTP 429",              429, "rate limited", 0},
    {"HTTP 500",              500, "server error", 0},
    {"20 second stall",       200, R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":4000,\"reason\":\"x\"}"}]}}]})", 20000},
  };

  for (const auto &c : cases) {
    resetFirmware();
    onlineMode = true; aiAvailable = true;
    sensors.soilPercent = 20.0f; sensors.soilValid = true;
    sensors.temperature = 30.0f;

    sil::net::queuePost(c.code, c.body, c.latency);
    makeDecision();

    ck(decision.waterDuration <= PUMP_MAX_MS,
       std::string("water duration <= 10000 ms: ") + c.name);
    ck(decision.fertDuration <= FERT_MAX_MS,
       std::string("fertiliser duration <= 5000 ms: ") + c.name);
    ck(!(decision.pumpWater && decision.waterDuration == 0),
       std::string("never commanded to pump for 0 ms: ") + c.name);
  }
}

/* ===========================================================================
 *  §7.4 invariant 5 — fertiliser is never applied from the local path.
 * ======================================================================== */
static void invariant5_noLocalFertiliser() {
  std::printf("\n[5] Invariant 5: no fertiliser from the local threshold path\n");

  for (int pct = 0; pct <= 100; pct += 5) {
    for (float t = 10.0f; t <= 45.0f; t += 5.0f) {
      resetFirmware();
      onlineMode = false; aiAvailable = false;
      sensors.soilPercent = (float)pct; sensors.soilValid = true;
      sensors.temperature = t;
      makeDecision();
      if (decision.pumpFertilizer || decision.fertDuration > 0) {
        ck(false, "local path commanded fertiliser at soil "
                  + std::to_string(pct) + "%, " + std::to_string((int)t) + "C");
        return;
      }
    }
  }
  ck(true, "no fertiliser from the local path across 8x15 soil/temperature grid");
}

/* ===========================================================================
 *  §7.4 invariant 4 — the cooldown holds BOTH pumps, not just water.
 * ======================================================================== */
static void invariant4_cooldownHoldsBoth() {
  std::printf("\n[6] Invariant 4: cooldown holds both pumps and defers fertiliser\n");

  resetFirmware();
  onlineMode = true; aiAvailable = true;
  sensors.soilPercent = 15.0f; sensors.soilValid = true;

  /*  A pump stopped one second ago: well inside the 120 s cooldown. */
  lastPumpStop = sil::clock_ms - 1000;

  sil::net::queuePost(200,
      R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":8000,\"fertilizer_duration_ms\":3000,\"reason\":\"x\"}"}]}}]})");
  makeDecision();

  ck(!decision.pumpWater,      "water held during cooldown");
  ck(!decision.pumpFertilizer, "fertiliser held during cooldown");
  ckEqI((long)decision.waterDuration, 0, "water duration zeroed during cooldown");
  ckEqI((long)decision.fertDuration,  0, "fert duration zeroed during cooldown");
  ck(decision.fertilizerDeferred, "fertilizer_deferred set during cooldown");

  /*  Fast-forward past the cooldown — one line, thanks to the virtual clock. */
  sil::advance(PUMP_COOLDOWN_MS + 1);
  sil::net::queuePost(200,
      R"({"candidates":[{"content":{"parts":[{"text":"{\"water_duration_ms\":8000,\"reason\":\"x\"}"}]}}]})");
  makeDecision();
  ck(decision.pumpWater, "water allowed again once the cooldown elapses");
}

/* ===========================================================================
 *  §7.4 invariant 9 — millis() rollover.
 *  Start the clock just below the 32-bit wrap and drive through it.
 * ======================================================================== */
static void invariant9_rollover() {
  std::printf("\n[7] Invariant 9: behaviour across the millis() rollover\n");

  resetFirmware();
  sil::setClock(0xFFFFF000UL);          // ~4 seconds before the wrap
  onlineMode = false; aiAvailable = false;
  sensors.soilPercent = 20.0f; sensors.soilValid = true;

  lastPumpStop = sil::clock_ms;          // pump just stopped, pre-wrap
  makeDecision();
  ck(!decision.pumpWater, "cooldown still blocks immediately before the wrap");

  sil::advance(PUMP_COOLDOWN_MS + 1);    // crosses 0xFFFFFFFF
  ck(sil::clock_ms < 0xFFFFF000UL, "virtual clock really did wrap");

  makeDecision();
  ck(decision.pumpWater, "cooldown correctly expires across the rollover");
}

/* ===========================================================================
 *  §8.1 security lens — hostile dashboard commands.
 * ======================================================================== */
static void hostileDashboardCommands() {
  std::printf("\n[8] Security lens: hostile Firebase command values\n");

  const int pots[] = {99, -1, 0, 6, 2147483647};
  for (int p : pots) {
    resetFirmware();
    onlineMode = true;
    mission = ST_IDLE;
    robotCurrentPot = 1;
    sil::fb::putInt("/device/esp32_a/command/target_pot", p);
    pollFirebaseCommand();
    ck(targetPot == 0 || (targetPot >= 1 && targetPot <= POT_COUNT),
       "target_pot " + std::to_string(p) + " rejected or clamped into 1.."
       + std::to_string(POT_COUNT));
  }

  /*  A string where the dashboard should have written an action. */
  resetFirmware();
  onlineMode = true; mission = ST_IDLE;
  sil::fb::putString("/device/esp32_a/command/action", "'; DROP TABLE --");
  pollFirebaseCommand();
  ck(mission == ST_IDLE, "unknown action string leaves the mission idle");
}

/* --- entry point --------------------------------------------------------- */
int main() {
  std::printf("========================================================\n");
  std::printf(" Aqua-M V2 — ESP32 A, SIL (software-in-the-loop) harness\n");
  std::printf(" SIMULATION ONLY. No hardware measurement is included.\n");
  std::printf("========================================================\n");

  knownAnswers();
  invariant1_noNetworkWhilePumping();
  invariant2_safeReset();
  invariant3_durationClamp();
  invariant4_cooldownHoldsBoth();
  invariant5_noLocalFertiliser();
  invariant9_rollover();
  hostileDashboardCommands();

  std::printf("\n--------------------------------------------------------\n");
  std::printf(" SIL summary: %d passed, %d failed\n", g_pass, g_fail);
  if (!g_failures.empty()) {
    std::printf("\n Failures:\n");
    for (auto &f : g_failures) std::printf("   - %s\n", f.c_str());
  }
  std::printf("--------------------------------------------------------\n");
  return g_fail == 0 ? 0 : 1;
}

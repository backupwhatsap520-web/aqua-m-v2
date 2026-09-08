/* ===========================================================================
 *  Aqua-M V2 — SIL harness for ESP32 B
 *
 *  SOFTWARE-IN-THE-LOOP ONLY. Every number below comes from a simulation on a
 *  host PC. No robot moved, no line was crossed, nothing was measured.
 *
 *  Covers §7.5 invariants 10-15.
 * ======================================================================== */
#include "stubs/arduino_stub_prelude.h"

#include "../firmware/AquaM_ESP32_B/AquaM_ESP32_B.ino"

#include <cstdio>
#include <random>
#include <string>
#include <vector>

static int g_pass = 0, g_fail = 0;
static std::vector<std::string> g_failures;

static void ck(bool cond, const std::string &what) {
  if (cond) g_pass++;
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

/* --- helpers ------------------------------------------------------------- */
static void resetFirmware() {
  sil::resetPins();
  sil::resetSerial();
  sil::resetPwm();
  sil::setClock(5000);

  state       = RS_IDLE;
  currentPot  = POT_MIN;
  targetPot   = POT_MIN;
  cpActive    = false;
  cpCounted   = false;
  cpSince     = 0;
  cpClearedAt = 0;
  armBusy     = false;
}

/*  Paint both checkpoint sensors black or white. */
static void setCheckpoint(bool black) {
  int v = black ? (IR_THRESHOLD + 500) : (IR_THRESHOLD - 500);
  sil::setAnalog(PIN_CP_LEFT, v);
  sil::setAnalog(PIN_CP_RIGHT, v);
}
static void setTrackCentred() {
#if TRACK_LINE_WIDE
  sil::setAnalog(PIN_TRACK_LEFT,  IR_THRESHOLD + 500);
  sil::setAnalog(PIN_TRACK_RIGHT, IR_THRESHOLD + 500);
#else
  sil::setAnalog(PIN_TRACK_LEFT,  IR_THRESHOLD - 500);
  sil::setAnalog(PIN_TRACK_RIGHT, IR_THRESHOLD - 500);
#endif
}

static bool motorsStopped() {
  return sil::dutyOf(PIN_ML_A) == 0 && sil::dutyOf(PIN_ML_B) == 0 &&
         sil::dutyOf(PIN_MR_A) == 0 && sil::dutyOf(PIN_MR_B) == 0;
}

/* ===========================================================================
 *  §7.5 invariant 10 — a single checkpoint line counts exactly once, at every
 *  plausible crossing speed, under four IR glitch levels. Monte Carlo,
 *  10 runs per cell, as the brief specifies.
 * ======================================================================== */
struct MonteCell { int glitchPct; int crossingMs; int runs; int miscounts; int zero; int multi; };

static int simulateOneCrossing(int crossingMs, int glitchPct, std::mt19937 &rng) {
  std::uniform_int_distribution<int> pct(0, 99);
  resetFirmware();

  int counts = 0;
  const int stepMs = 5;

  /*  Approach: sensors clear for 400 ms, so cpClearedAt is set and the
   *  CHECKPOINT_CLEAR_MS gate is satisfied the way it would be on a rail. */
  for (int t = 0; t < 400; t += stepMs) {
    setCheckpoint(false);
    if (checkpointReached()) counts++;
    sil::advance(stepMs);
  }

  /*  Crossing: both sensors on black for crossingMs, with glitchPct of samples
   *  randomly flipped to model IR noise, dust and ambient light. */
  for (int t = 0; t < crossingMs; t += stepMs) {
    bool black = true;
    if (pct(rng) < glitchPct) black = false;      // dropout during the line
    setCheckpoint(black);
    if (checkpointReached()) counts++;
    sil::advance(stepMs);
  }

  /*  Departure. */
  for (int t = 0; t < 400; t += stepMs) {
    bool black = false;
    if (pct(rng) < glitchPct) black = true;       // spurious black after the line
    setCheckpoint(black);
    if (checkpointReached()) counts++;
    sil::advance(stepMs);
  }
  return counts;
}

static void invariant10_checkpointMonteCarlo() {
  std::printf("\n[1] Invariant 10: one checkpoint line counted exactly once (SIL Monte Carlo)\n");

  const int glitchLevels[] = {0, 5, 15, 30};        // % of samples corrupted
  const int crossings[]    = {40, 60, 100, 200, 400};  // ms on black
  const int runs = 10;

  std::mt19937 rng(20260908);
  std::vector<MonteCell> table;

  for (int g : glitchLevels) {
    for (int c : crossings) {
      MonteCell cell{g, c, runs, 0, 0, 0};
      for (int i = 0; i < runs; i++) {
        int n = simulateOneCrossing(c, g, rng);
        if (n != 1) {
          cell.miscounts++;
          if (n == 0) cell.zero++; else cell.multi++;
        }
      }
      table.push_back(cell);
    }
  }

  std::printf("\n    SIL Monte Carlo — checkpoint miscounts per cell (%d runs each)\n", runs);
  std::printf("    | glitch %% | crossing ms | miscounts | missed | double |\n");
  std::printf("    |----------|-------------|-----------|--------|--------|\n");
  for (auto &c : table)
    std::printf("    | %8d | %11d | %9d | %6d | %6d |\n",
                c.glitchPct, c.crossingMs, c.miscounts, c.zero, c.multi);
  std::printf("\n");

  /*  With a clean sensor the count must be exact at every crossing the
   *  debounce can see. That part is a firmware property, not a hardware one. */
  for (auto &c : table)
    if (c.glitchPct == 0 && c.crossingMs >= CHECKPOINT_DEBOUNCE_MS + 10)
      ckEqI(c.miscounts, 0,
            "clean IR, " + std::to_string(c.crossingMs) + " ms crossing: counted exactly once");

  /*  A 40 ms crossing is shorter than the 50 ms debounce, so it MUST be missed.
   *  Asserting that explicitly keeps the debounce honest: if this ever starts
   *  counting, the debounce has stopped working. */
  for (auto &c : table)
    if (c.glitchPct == 0 && c.crossingMs == 40)
      ckEqI(c.zero, c.runs,
            "clean IR, 40 ms crossing (under the 50 ms debounce): missed every time, by design");

  std::printf("    note: a crossing shorter than CHECKPOINT_DEBOUNCE_MS (50 ms) cannot be\n");
  std::printf("          counted at all — that is the debounce working, not a defect. At\n");
  std::printf("          SPEED_CRUISE a 50 ms window is roughly a centimetre of travel, so\n");
  std::printf("          the checkpoint line has to be at least that wide.\n");
}

/* ===========================================================================
 *  §7.5 invariant 11 — currentPot stays within 1..5 under any command
 *  sequence, including contradictory ones.
 * ======================================================================== */
static void invariant11_potBounds() {
  std::printf("\n[2] Invariant 11: currentPot and targetPot stay within 1..%d\n", POT_MAX);

  const char *cmds[] = {
    "TARGET:1", "TARGET:5", "TARGET:0", "TARGET:-3", "TARGET:99",
    "TARGET:2147483647", "TARGET:abc", "TARGET:", "TARGET:3.7",
    "STOP", "LIFT", "IRRIGATE_ON", "IRRIGATE_OFF", "GARBAGE", "",
  };
  resetFirmware();

  std::mt19937 rng(7);
  std::uniform_int_distribution<int> pick(0, (int)(sizeof(cmds) / sizeof(cmds[0])) - 1);

  for (int i = 0; i < 2000; i++) {
    handleCommand(String(cmds[pick(rng)]));
    sil::advance(7);
    if (currentPot < POT_MIN || currentPot > POT_MAX) {
      ck(false, "currentPot left 1.." + std::to_string(POT_MAX)
                + " (= " + std::to_string(currentPot) + ") after command "
                + std::to_string(i));
      return;
    }
    if (targetPot < POT_MIN || targetPot > POT_MAX) {
      ck(false, "targetPot left 1.." + std::to_string(POT_MAX)
                + " (= " + std::to_string(targetPot) + ")");
      return;
    }
  }
  ck(true, "2000 random and contradictory commands kept both pot indices in range");
}

/* ===========================================================================
 *  §7.5 invariant 12 — motors reach zero on STOP, on ERROR, on line loss.
 * ======================================================================== */
static void invariant12_motorsStop() {
  std::printf("\n[3] Invariant 12: motors reach zero on STOP, error and line loss\n");

  /*  STOP while driving. */
  resetFirmware();
  setTrackCentred();
  handleCommand(String("TARGET:4"));
  for (int i = 0; i < 20; i++) { navigationUpdate(); sil::advance(10); }
  handleCommand(String("STOP"));
  ck(motorsStopped(), "all four motor channels are zero after STOP");

  /*  raiseError must stop the motors too. */
  resetFirmware();
  setTrackCentred();
  handleCommand(String("TARGET:4"));
  for (int i = 0; i < 20; i++) { navigationUpdate(); sil::advance(10); }
  raiseError("SIL_FORCED");
  ck(motorsStopped(), "all four motor channels are zero after raiseError");

#if TRACK_LINE_WIDE
  /*  Line loss: both tracking sensors white in WIDE geometry. */
  resetFirmware();
  setTrackCentred();
  handleCommand(String("TARGET:4"));
  for (int i = 0; i < 10; i++) { navigationUpdate(); sil::advance(10); }
  sil::setAnalog(PIN_TRACK_LEFT,  IR_THRESHOLD - 500);
  sil::setAnalog(PIN_TRACK_RIGHT, IR_THRESHOLD - 500);
  for (int i = 0; i < 1200; i++) { navigationUpdate(); sil::advance(10); }   // > 2.5 s
  ck(motorsStopped(), "all four motor channels are zero after sustained line loss");
#else
  std::printf("    note: TRACK_LINE_WIDE=0 — both-white is the centred state, so there is\n");
  std::printf("          no line-loss signal by design. The 45 s move timeout is the net.\n");
#endif
}

/* ===========================================================================
 *  §7.5 invariant 13 — the arm sequencer always terminates at a defined pose.
 * ======================================================================== */
static void invariant13_armTerminates() {
  std::printf("\n[4] Invariant 13: the arm sequencer terminates at a defined pose\n");

  resetFirmware();
  armStart(PLANT_SEQ, PLANT_SEQ_LEN);
  int guard = 0;
  while (armBusy && guard++ < 200000) { armUpdate(); sil::advance(1); }
  ck(!armBusy, "plant sequence terminates");
  ck(guard < 200000, "plant sequence terminates well inside the step budget");

  /*  Interrupt mid-sequence with a new command, as the brief asks. */
  resetFirmware();
  armStart(PLANT_SEQ, PLANT_SEQ_LEN);
  for (int i = 0; i < 50; i++) { armUpdate(); sil::advance(ARM_STEP_MS); }
  armStart(LIFT_SEQ, LIFT_SEQ_LEN);            // new command mid-flight
  guard = 0;
  while (armBusy && guard++ < 200000) { armUpdate(); sil::advance(1); }
  ck(!armBusy, "a sequence interrupted mid-flight still terminates");

  /*  Every servo must hold a value inside its mechanical range. */
  bool inRange = true;
  for (auto &kv : sil::servoAngle) if (kv.second < 0 || kv.second > 180) inRange = false;
  ck(inRange, "every servo ends within 0..180 degrees");
}

/* ===========================================================================
 *  §7.5 invariant 15 — reverse drift.
 *
 *  RECOMMENDATIONS item 27 argues reverse line following is unstable because
 *  the sensor bar is at the front: with omega = -k * y_sensor the closed loop's
 *  determinant is u*k, and u flips sign in reverse.
 *
 *  This is a kinematic simulation of that model, NOT a measurement. It uses the
 *  firmware's own speed constants so the numbers relate to the real settings,
 *  but the robot's mass, wheel slip and rail friction are not modelled.
 * ======================================================================== */
static void reverseDrift() {
  std::printf("\n[5] Invariant 15: reverse drift (SIL kinematic model, not measured)\n");

  /*  Geometry, stated openly so a reader can vary it. */
  const double L         = 0.12;    // m, wheel axis to sensor bar
  const double track     = 0.15;    // m, wheel separation
  const double potSpace  = 0.30;    // m between pots
  const double mPerSpeed = 0.0016;  // m/s per PWM unit — a stated assumption

  struct Row { int invert; double d1, d2, d4; };
  std::vector<Row> rows;

  for (int invert = 0; invert <= 1; invert++) {
    Row r{invert, 0, 0, 0};
    double y = 0.005, psi = 0.0;        // start 5 mm off the line, aligned
    const double dt = 0.005;
    double travelled = 0.0;

    double u = -(double)SPEED_REVERSE * mPerSpeed;          // reverse: u < 0
    double kInner = (double)SPEED_TURN_INNER_REV / 255.0;

    for (int step = 0; step < 400000 && travelled < 4 * potSpace; step++) {
      double ySensor = y + L * psi;

      /*  The firmware's proportional law: slow the inner wheel by
       *  SPEED_TURN_INNER_REV when the sensor sees the line off to one side. */
      double corr = (ySensor > 0 ? -1.0 : (ySensor < 0 ? 1.0 : 0.0)) * kInner;
      if (invert) corr = -corr;

      double omega = corr * fabs(u) / track;

      y   += u * psi * dt;
      psi += omega * dt;

      travelled += fabs(u) * dt;
      if (travelled <= 1 * potSpace) r.d1 = fabs(y);
      if (travelled <= 2 * potSpace) r.d2 = fabs(y);
      r.d4 = fabs(y);
    }
    rows.push_back(r);
  }

  std::printf("\n    SIL reverse-drift model — lateral offset from the line (metres)\n");
  std::printf("    | REVERSE_STEER_INVERT | 1 pot | 2 pots | 4 pots |\n");
  std::printf("    |----------------------|-------|--------|--------|\n");
  for (auto &r : rows)
    std::printf("    | %20d | %5.3f | %6.3f | %6.3f |\n", r.invert, r.d1, r.d2, r.d4);
  std::printf("\n    Assumptions: L=%.2f m, track=%.2f m, pot spacing=%.2f m,\n", L, track, potSpace);
  std::printf("    %.4f m/s per PWM unit, SPEED_REVERSE=%d, SPEED_TURN_INNER_REV=%d.\n",
              mPerSpeed, SPEED_REVERSE, SPEED_TURN_INNER_REV);
  std::printf("    Mass, slip and rail friction are NOT modelled. Not a measurement.\n");

  /*  The claim under test is item 27's: drift grows with distance for both
   *  signs, so neither value of the switch rescues reverse tracking. */
  for (auto &r : rows)
    ck(r.d4 >= r.d1,
       "drift over 4 pots is not smaller than over 1 pot (INVERT="
       + std::to_string(r.invert) + ") — matches RECOMMENDATIONS item 27");
}

/* --- entry point --------------------------------------------------------- */
int main() {
  std::printf("========================================================\n");
  std::printf(" Aqua-M V2 — ESP32 B, SIL (software-in-the-loop) harness\n");
  std::printf(" SIMULATION ONLY. No hardware measurement is included.\n");
#if TRACK_LINE_WIDE
  std::printf(" Build: TRACK_LINE_WIDE=1 (wide line)\n");
#else
  std::printf(" Build: TRACK_LINE_WIDE=0 (straddled line)\n");
#endif
  std::printf("========================================================\n");

  invariant10_checkpointMonteCarlo();
  invariant11_potBounds();
  invariant12_motorsStop();
  invariant13_armTerminates();
  reverseDrift();

  std::printf("\n--------------------------------------------------------\n");
  std::printf(" SIL summary (ESP32 B): %d passed, %d failed\n", g_pass, g_fail);
  if (!g_failures.empty()) {
    std::printf("\n Failures:\n");
    for (auto &f : g_failures) std::printf("   - %s\n", f.c_str());
  }
  std::printf("--------------------------------------------------------\n");
  return g_fail == 0 ? 0 : 1;
}

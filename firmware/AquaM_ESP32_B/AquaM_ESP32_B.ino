/*
 * ============================================================================
 *  AQUA-M V2 — ESP32 B  (Motion Unit)
 * ----------------------------------------------------------------------------
 *  Responsibilities:
 *    - Follow the black track with 4x TCRT5000 infrared sensors
 *    - Count horizontal checkpoint lines to know which pot it is standing at
 *    - Drive two DC motors through BTS7960 drivers
 *    - Operate the 4-servo arm (base / shoulder / elbow / wrist)
 *    - Obey ESP32 A over UART and report its own status back
 *
 *  ESP32 B has NO WiFi. Everything it knows travels over the UART link;
 *  ESP32 A mirrors this unit's status into Firebase.
 *
 *  Board  : ESP32 Dev Module
 *  Scheme : "Huge APP (3MB No OTA / 1MB SPIFFS)"
 *
 *  SCOPE  : navigation is intentionally limited to a straight, single-track
 *           layout. Branching tracks are documented as future work.
 * ============================================================================
 */

#include <ESP32Servo.h>
#include <esp_task_wdt.h>

/* ===========================================================================
 *  1. BENCH-TEST SWITCHES
 *     Four things that depend on the physical robot rather than on the code.
 *     Each is one line. Verify them on the bench before a long run.
 * ======================================================================== */

/*  1a. CHECKPOINT SENSOR ROLE
 *  0 = the two OUTER sensors detect the checkpoint line, the two INNER
 *      sensors keep the robot on the track.   <-- the physical Aqua-M V2
 *  1 = the reverse.
 *  Verify: push the robot along the track by hand and watch which pair goes
 *  black only when it crosses a perpendicular line.
 *  Guarded so the build matrix can override it with -D; default unchanged. */
#ifndef CHECKPOINT_USES_INNER_SENSORS
#define CHECKPOINT_USES_INNER_SENSORS 0
#endif

/*  1b. TRACK LINE GEOMETRY — how the two tracking sensors sit on the line.
 *  1 = WIDE line: when centred, BOTH tracking sensors read black.
 *      Both white then means the robot has left the track.
 *  0 = STRADDLED line: the line passes BETWEEN the two tracking sensors, so
 *      when centred BOTH read white and only one goes black on a drift.
 *      Line-loss cannot be detected in this geometry — both-white is the
 *      normal state — so the 45 s move timeout is the safety net instead.
 *  Verify: park the robot centred on the track and read both sensors.
 *  Guarded so the build matrix can override it with -D; default unchanged. */
#ifndef TRACK_LINE_WIDE
#define TRACK_LINE_WIDE 1
#endif

/*  1c. REVERSE STEERING SIGN
 *  0 = reverse uses the same correction sign as forward.
 *  1 = reverse inverts the correction.
 *  Read section 11 of this file before testing: with the sensors mounted at
 *  the front, reverse line following is unstable for either sign. The switch
 *  exists so you can see which one wanders less over the short distance
 *  between two pots.
 *  Guarded so the build matrix can override it with -D; default unchanged. */
#ifndef REVERSE_STEER_INVERT
#define REVERSE_STEER_INVERT 0
#endif

/*  1d. MOTOR DRIVER WIRING
 *  1 = BTS7960 native: both pins of a motor carry PWM (RPWM / LPWM),
 *      R_EN and L_EN tied to +5 V. No extra parts needed.
 *  0 = L298N style: pin A carries PWM, pin B is a plain direction bit.
 *  Guarded so the build matrix can override it with -D; default unchanged. */
#ifndef MOTOR_DRIVER_DUAL_PWM
#define MOTOR_DRIVER_DUAL_PWM 1
#endif

/* ===========================================================================
 *  2. PIN MAPPING
 * ======================================================================== */
#define PIN_IR_LEFT_OUTER   34   // ADC1, input only
#define PIN_IR_LEFT_INNER   35   // ADC1, input only
#define PIN_IR_RIGHT_INNER  39   // ADC1, input only
#define PIN_IR_RIGHT_OUTER  36   // ADC1, input only

#define PIN_ML_A            12   // left  motor: RPWM (or PWM)
#define PIN_ML_B            13   // left  motor: LPWM (or DIR)
#define PIN_MR_A            14   // right motor: RPWM (or PWM)
#define PIN_MR_B            15   // right motor: LPWM (or DIR)

#define PIN_SERVO_BASE      25
#define PIN_SERVO_SHOULDER  26
#define PIN_SERVO_ELBOW     27
#define PIN_SERVO_WRIST     32

#define PIN_UART_RX         16   // <- ESP32 A TX
#define PIN_UART_TX         17   // -> ESP32 A RX

/*  NOTE ON GPIO 12 and GPIO 15: both are boot strapping pins. Add a 10 kO
 *  pull-down on GPIO 12 and a 10 kO pull-up on GPIO 15 (or simply keep the
 *  driver unpowered until the ESP32 has booted). See RECOMMENDATIONS.md. */

/* ===========================================================================
 *  3. CONSTANTS
 * ======================================================================== */
#define IR_THRESHOLD        2000   // ADC value: above = black line, below = floor
#define CHECKPOINT_DEBOUNCE_MS 50  // both checkpoint sensors held for 50 ms
#define CHECKPOINT_CLEAR_MS   150  // line must clear before the next count

#define PWM_FREQ            5000
#define PWM_RES             8      // 0..255
#define CH_ML_A             8
#define CH_ML_B             9
#define CH_MR_A            10
#define CH_MR_B            11

#define SPEED_CRUISE        170
#define SPEED_TURN_INNER     70
#define SPEED_REVERSE       120    // slower than cruise: see section 11
#define SPEED_TURN_INNER_REV 95    // gentler correction while reversing
#define SPEED_SEARCH        120

#define WDT_TIMEOUT_S         8    // nothing in this sketch blocks, so 8 s is ample

#define ARM_STEP_MS          15    // one degree per step -> ~180 deg in 2.7 s
#define ARM_SETTLE_MS       300

#define MOVE_TIMEOUT_MS   45000UL  // give up if a checkpoint never arrives
#define LINE_LOST_MS       2500UL  // all sensors off the track for this long

#define POT_MIN               1
#define POT_MAX               5

/*  Sensor role resolution */
#if CHECKPOINT_USES_INNER_SENSORS
  #define PIN_CP_LEFT      PIN_IR_LEFT_INNER
  #define PIN_CP_RIGHT     PIN_IR_RIGHT_INNER
  #define PIN_TRACK_LEFT   PIN_IR_LEFT_OUTER
  #define PIN_TRACK_RIGHT  PIN_IR_RIGHT_OUTER
#else
  #define PIN_CP_LEFT      PIN_IR_LEFT_OUTER
  #define PIN_CP_RIGHT     PIN_IR_RIGHT_OUTER
  #define PIN_TRACK_LEFT   PIN_IR_LEFT_INNER
  #define PIN_TRACK_RIGHT  PIN_IR_RIGHT_INNER
#endif

/* ===========================================================================
 *  4. OBJECTS & STATE
 * ======================================================================== */
Servo servoBase, servoShoulder, servoElbow, servoWrist;

int currentPot = POT_MIN;
int targetPot  = POT_MIN;

enum RobotState {
  RS_IDLE,
  RS_MOVING,
  RS_ARM_PLANTING,
  RS_PLANTED,
  RS_IRRIGATING,
  RS_ARM_LIFTING,
  RS_ERROR
};
RobotState state = RS_IDLE;

uint32_t moveStartMs   = 0;
uint32_t lineLostSince = 0;
int      lastTrackDir  = 0;      // -1 = line was to the left, +1 = to the right

/* checkpoint detection */
bool     cpActive      = false;  // both checkpoint sensors currently on black
uint32_t cpSince       = 0;
bool     cpCounted     = false;  // this line has already been counted
uint32_t cpClearedAt   = 0;

/* UART */
String rxBuffer = "";

/* ===========================================================================
 *  5. ARM POSES  {base, shoulder, elbow, wrist}
 *     Tune these four rows once against the real mechanics.
 * ======================================================================== */
struct Pose { int base, shoulder, elbow, wrist; };

const Pose POSE_HOME     = {  90, 150,  30,  90 };  // folded, travelling
const Pose POSE_OVER_POT = {  90, 120,  70,  90 };  // hovering above the soil
const Pose POSE_PLANTED  = {  90,  70, 120,  90 };  // probe pushed into soil

const Pose PLANT_SEQ[] = { POSE_OVER_POT, POSE_PLANTED };
const Pose LIFT_SEQ[]  = { POSE_OVER_POT, POSE_HOME    };
const uint8_t PLANT_SEQ_LEN = sizeof(PLANT_SEQ) / sizeof(Pose);
const uint8_t LIFT_SEQ_LEN  = sizeof(LIFT_SEQ)  / sizeof(Pose);

const Pose *armSeq      = nullptr;
uint8_t     armSeqLen   = 0;
uint8_t     armSeqIndex = 0;
Pose        armNow      = POSE_HOME;
uint32_t    armLastStep = 0;
uint32_t    armSettleAt = 0;
bool        armBusy     = false;

/* ===========================================================================
 *  6. PWM COMPATIBILITY (Arduino-ESP32 core 2.x and 3.x)
 * ======================================================================== */
static inline void pwmSetup(uint8_t pin, uint8_t ch) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcAttachChannel(pin, PWM_FREQ, PWM_RES, ch);
#else
  ledcSetup(ch, PWM_FREQ, PWM_RES);
  ledcAttachPin(pin, ch);
#endif
}

static inline void pwmWrite(uint8_t pin, uint8_t ch, uint32_t duty) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  ledcWrite(pin, duty);
  (void)ch;
#else
  ledcWrite(ch, duty);
  (void)pin;
#endif
}

/* ===========================================================================
 *  7. MOTOR CONTROL
 *     speed: -255 .. +255   (positive = forward)
 * ======================================================================== */
void motorWrite(uint8_t pinA, uint8_t chA, uint8_t pinB, uint8_t chB, int speed) {
  speed = constrain(speed, -255, 255);
#if MOTOR_DRIVER_DUAL_PWM
  if (speed > 0)      { pwmWrite(pinA, chA, speed); pwmWrite(pinB, chB, 0); }
  else if (speed < 0) { pwmWrite(pinA, chA, 0);     pwmWrite(pinB, chB, -speed); }
  else                { pwmWrite(pinA, chA, 0);     pwmWrite(pinB, chB, 0); }  // coast/brake
#else
  digitalWrite(pinB, speed >= 0 ? HIGH : LOW);
  pwmWrite(pinA, chA, abs(speed));
  (void)chB;
#endif
}

void driveMotors(int left, int right) {
  motorWrite(PIN_ML_A, CH_ML_A, PIN_ML_B, CH_ML_B, left);
  motorWrite(PIN_MR_A, CH_MR_A, PIN_MR_B, CH_MR_B, right);
}

void stopMotors() { driveMotors(0, 0); }

/* ===========================================================================
 *  8. INFRARED SENSING
 * ======================================================================== */
bool onBlack(uint8_t pin) { return analogRead(pin) > IR_THRESHOLD; }

/*  Returns  0 = no correction needed,
 *          -1 = the line is toward the LEFT sensor  (steer left),
 *          +1 = the line is toward the RIGHT sensor (steer right),
 *           2 = line lost — WIDE geometry only. */
int readTrackError() {
  bool l = onBlack(PIN_TRACK_LEFT);
  bool r = onBlack(PIN_TRACK_RIGHT);
  if (l && !r)  return -1;
  if (!l && r)  return +1;
#if TRACK_LINE_WIDE
  if (l && r)   return 0;       // centred: the line covers both sensors
  return 2;                     // both white: off the track
#else
  return 0;                     // straddled: both white is centred,
                                // both black is a crossing line. Either way,
                                // no correction and no line-loss signal.
#endif
}

/*  Edge-triggered checkpoint detector.
 *  A checkpoint counts once when BOTH checkpoint sensors have been on black
 *  continuously for CHECKPOINT_DEBOUNCE_MS. It cannot count again until the
 *  sensors have been clear for CHECKPOINT_CLEAR_MS. */
bool checkpointReached() {
  bool both = onBlack(PIN_CP_LEFT) && onBlack(PIN_CP_RIGHT);
  uint32_t now = millis();

  if (both) {
    if (!cpActive) { cpActive = true; cpSince = now; }
    if (!cpCounted && (now - cpSince) >= CHECKPOINT_DEBOUNCE_MS &&
        (cpClearedAt == 0 || (now - cpClearedAt) >= CHECKPOINT_CLEAR_MS)) {
      cpCounted = true;
      return true;
    }
  } else {
    if (cpActive) { cpActive = false; cpClearedAt = now; }
    cpCounted = false;
  }
  return false;
}

/* ===========================================================================
 *  9. UART HELPERS
 * ======================================================================== */
void reply(const String &msg) {
  Serial2.print(msg);
  Serial2.print('\n');
  Serial.print("[TX->A] ");
  Serial.println(msg);
}

void raiseError(const String &kind) {
  stopMotors();
  state = RS_ERROR;
  reply(String("ERROR:") + kind);
}

/* ===========================================================================
 * 10. ARM SEQUENCER (non-blocking, one degree per ARM_STEP_MS)
 * ======================================================================== */
void armApply() {
  servoBase.write(armNow.base);
  servoShoulder.write(armNow.shoulder);
  servoElbow.write(armNow.elbow);
  servoWrist.write(armNow.wrist);
}

void armStart(const Pose *seq, uint8_t len) {
  armSeq      = seq;
  armSeqLen   = len;
  armSeqIndex = 0;
  armBusy     = true;
  armSettleAt = 0;
  armLastStep = millis();
}

int stepToward(int now, int goal) {
  if (now < goal) return now + 1;
  if (now > goal) return now - 1;
  return now;
}

/*  Returns true on the step where the whole sequence finishes. */
bool armUpdate() {
  if (!armBusy) return false;
  uint32_t now = millis();

  if (armSettleAt != 0) {                    // pausing between waypoints
    if (now < armSettleAt) return false;
    armSettleAt = 0;
    armSeqIndex++;
    if (armSeqIndex >= armSeqLen) { armBusy = false; return true; }
  }

  if (now - armLastStep < ARM_STEP_MS) return false;
  armLastStep = now;

  Pose goal = armSeq[armSeqIndex];
  armNow.base     = stepToward(armNow.base,     goal.base);
  armNow.shoulder = stepToward(armNow.shoulder, goal.shoulder);
  armNow.elbow    = stepToward(armNow.elbow,    goal.elbow);
  armNow.wrist    = stepToward(armNow.wrist,    goal.wrist);
  armApply();

  if (armNow.base == goal.base && armNow.shoulder == goal.shoulder &&
      armNow.elbow == goal.elbow && armNow.wrist == goal.wrist) {
    armSettleAt = now + ARM_SETTLE_MS;
  }
  return false;
}

/* ===========================================================================
 * 11. NAVIGATION
 * ======================================================================== */
void beginMove(int pot) {
  targetPot = constrain(pot, POT_MIN, POT_MAX);

  if (targetPot == currentPot) {              // already parked at this pot
    reply(String("ARRIVED:") + currentPot);
    state = RS_ARM_PLANTING;
    armStart(PLANT_SEQ, PLANT_SEQ_LEN);
    return;
  }

  moveStartMs   = millis();
  lineLostSince = 0;
  cpCounted     = false;
  cpActive      = false;
  state         = RS_MOVING;
  reply("MOVING");
}

void navigationUpdate() {
  bool forward = (targetPot > currentPot);
  int  err     = readTrackError();
  uint32_t now = millis();

  /* --- line-loss supervision ------------------------------------------- */
  if (err == 2) {
    if (lineLostSince == 0) lineLostSince = now;
    if (now - lineLostSince > LINE_LOST_MS) { raiseError("LINE_LOST"); return; }
  } else {
    lineLostSince = 0;
    if (err != 0) lastTrackDir = err;
  }

  if (now - moveStartMs > MOVE_TIMEOUT_MS) { raiseError("MOVE_TIMEOUT"); return; }

  /* --- steering ---------------------------------------------------------
   *  Slowing one wheel turns the robot toward that wheel. Forward: err == -1
   *  means the line sits toward the left sensor, so slow the left wheel and
   *  the nose swings left, back onto the line.
   *
   *  Reverse is not a mirror of this. See section 11 at the foot of the file:
   *  with the sensor bar at the front, the sensors trail the robot when it
   *  reverses and the correction loop is unstable for EITHER sign. Reverse
   *  therefore runs slower, corrects more gently, and the sign is left as a
   *  bench-test switch. */
  int base = forward ? SPEED_CRUISE : -SPEED_REVERSE;
  int left = base, right = base;

  int correction = err;
#if REVERSE_STEER_INVERT
  if (!forward) correction = -correction;
#endif

  const int slow = forward ? SPEED_TURN_INNER : -SPEED_TURN_INNER_REV;

  if (correction == -1)      { left  = slow; }
  else if (correction == +1) { right = slow; }
  else if (err == 2) {                       // sweep back toward the last edge
    int s = forward ? SPEED_SEARCH : -SPEED_SEARCH;
    if (lastTrackDir < 0) { left = s / 3; right = s; }
    else                  { left = s;     right = s / 3; }
  }
  driveMotors(left, right);

  /* --- checkpoint counting --------------------------------------------- */
  if (checkpointReached()) {
    currentPot += forward ? 1 : -1;
    currentPot = constrain(currentPot, POT_MIN, POT_MAX);
    Serial.printf("[NAV] checkpoint -> pot %d\n", currentPot);

    if (currentPot == targetPot) {
      stopMotors();
      reply(String("ARRIVED:") + currentPot);
      state = RS_ARM_PLANTING;               // handshake step 5: plant at once
      armStart(PLANT_SEQ, PLANT_SEQ_LEN);
    }
  }
}

/* ===========================================================================
 * 12. COMMAND HANDLING
 * ======================================================================== */
void handleCommand(String cmd) {
  cmd.trim();
  if (cmd.length() == 0) return;
  Serial.print("[RX<-A] ");
  Serial.println(cmd);

  if (cmd == "STOP") {
    stopMotors();
    armBusy = false;
    state   = RS_IDLE;
    reply("IDLE");
    return;
  }

  if (cmd == "RETURN") { beginMove(POT_MIN); return; }

  if (cmd.startsWith("TARGET:")) {
    int pot = cmd.substring(7).toInt();
    if (pot < POT_MIN || pot > POT_MAX) { raiseError("BAD_TARGET"); return; }
    if (state == RS_MOVING || armBusy)  { raiseError("BUSY");       return; }
    beginMove(pot);
    return;
  }

  if (cmd == "PLANT") {
    if (armBusy) return;
    state = RS_ARM_PLANTING;
    armStart(PLANT_SEQ, PLANT_SEQ_LEN);
    return;
  }

  if (cmd == "LIFT") {
    if (armBusy) return;
    state = RS_ARM_LIFTING;
    armStart(LIFT_SEQ, LIFT_SEQ_LEN);
    return;
  }

  if (cmd == "IRRIGATE_ON")  { state = RS_IRRIGATING; return; }  // hold still
  if (cmd == "IRRIGATE_OFF") { state = RS_PLANTED;    return; }
}

void uartUpdate() {
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') {
      handleCommand(rxBuffer);
      rxBuffer = "";
    } else if (c != '\r') {
      if (rxBuffer.length() < 64) rxBuffer += c;
      else rxBuffer = "";
    }
  }
}

/* ===========================================================================
 * 12b. HARDWARE WATCHDOG
 *      Recovers the board if a call ever hangs. Nothing in this sketch
 *      blocks, so the timeout can be short.
 * ======================================================================== */
void watchdogBegin() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  esp_task_wdt_config_t cfg = {
    .timeout_ms     = WDT_TIMEOUT_S * 1000,
    .idle_core_mask = 0,
    .trigger_panic  = true,
  };
  if (esp_task_wdt_reconfigure(&cfg) != ESP_OK) esp_task_wdt_init(&cfg);
#else
  esp_task_wdt_init(WDT_TIMEOUT_S, true);
#endif
  esp_task_wdt_add(NULL);            // watch the Arduino loop task
}

/* ===========================================================================
 * 13. SETUP
 * ======================================================================== */
void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, PIN_UART_RX, PIN_UART_TX);
  delay(200);
  Serial.println("\n[BOOT] Aqua-M V2 — ESP32 B");

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_IR_LEFT_OUTER,  ADC_11db);
  analogSetPinAttenuation(PIN_IR_LEFT_INNER,  ADC_11db);
  analogSetPinAttenuation(PIN_IR_RIGHT_INNER, ADC_11db);
  analogSetPinAttenuation(PIN_IR_RIGHT_OUTER, ADC_11db);

  pwmSetup(PIN_ML_A, CH_ML_A);
  pwmSetup(PIN_MR_A, CH_MR_A);
#if MOTOR_DRIVER_DUAL_PWM
  pwmSetup(PIN_ML_B, CH_ML_B);
  pwmSetup(PIN_MR_B, CH_MR_B);
#else
  pinMode(PIN_ML_B, OUTPUT);
  pinMode(PIN_MR_B, OUTPUT);
#endif
  stopMotors();

  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  servoBase.setPeriodHertz(50);      servoBase.attach(PIN_SERVO_BASE, 500, 2400);
  servoShoulder.setPeriodHertz(50);  servoShoulder.attach(PIN_SERVO_SHOULDER, 500, 2400);
  servoElbow.setPeriodHertz(50);     servoElbow.attach(PIN_SERVO_ELBOW, 500, 2400);
  servoWrist.setPeriodHertz(50);     servoWrist.attach(PIN_SERVO_WRIST, 500, 2400);

  armNow = POSE_HOME;
  armApply();

  state = RS_IDLE;
  watchdogBegin();
  reply("IDLE");
  Serial.println("[BOOT] ready");
}

/* ===========================================================================
 * 14. MAIN LOOP
 * ======================================================================== */
void loop() {
  esp_task_wdt_reset();
  uartUpdate();

  switch (state) {

    case RS_MOVING:
      navigationUpdate();
      break;

    case RS_ARM_PLANTING:
      if (armUpdate()) {
        state = RS_PLANTED;
        reply("SENSOR_READY");
      }
      break;

    case RS_ARM_LIFTING:
      if (armUpdate()) {
        state = RS_IDLE;
        reply("LIFTED");
        reply("IDLE");
      }
      break;

    case RS_PLANTED:
    case RS_IRRIGATING:
      stopMotors();          // hold position while ESP32 A reads and irrigates
      break;

    case RS_ERROR:
      stopMotors();
      break;

    case RS_IDLE:
    default:
      stopMotors();
      break;
  }
}

/* ===========================================================================
 * 15. WHY REVERSE LINE FOLLOWING IS THE WEAK POINT  (read before bench test)
 * ---------------------------------------------------------------------------
 *  The sensor bar is at the FRONT. Driving forward, the sensors lead: they
 *  see the error before the body gets there, and slowing the inner wheel
 *  pulls the nose back onto the line. That loop is stable.
 *
 *  Driving in reverse, the sensors TRAIL. Write y for the sideways offset of
 *  the sensor bar from the line, psi for the heading error, u for the speed
 *  along the heading (negative in reverse) and L for the distance from the
 *  wheel axis to the sensor bar:
 *
 *      y_sensor = y_body + L * psi
 *      d(y_body)/dt  = u * psi
 *      d(psi)/dt     = omega          (what the wheels control)
 *
 *  With a proportional law omega = -k * y_sensor, the closed loop has
 *  determinant u * k. Forward, u is positive and the loop converges.
 *  Reverse, u is negative, the determinant flips sign, and the loop becomes
 *  a saddle: it diverges. Inverting the sign does not rescue it either — that
 *  makes the trace positive instead. This is the same reason reversing a
 *  trailer is hard, and it is a property of where the sensors are mounted,
 *  not a bug in this code.
 *
 *  What that means in practice:
 *    - Over the short distance between two adjacent pots the robot usually
 *      makes it, because the L*omega term acts fast and the heading error has
 *      little time to build.
 *    - Over several pots in a row it will wander off.
 *
 *  Mitigations already in the code:
 *    - SPEED_REVERSE is lower than SPEED_CRUISE (less distance per unit of
 *      accumulating heading error).
 *    - SPEED_TURN_INNER_REV corrects more gently than the forward value.
 *    - REVERSE_STEER_INVERT lets you test both signs on the bench.
 *
 *  The real fix is a second, rear-facing pair of TCRT5000 sensors, so
 *  whichever end is leading is the one steering. Two spare ADC1 pins
 *  are still free on this board. Until then, prefer forward moves: driving
 *  1 -> 2 -> 3 -> 4 -> 5 and then returning in one reverse run is more
 *  reliable than hopping back and forth.
 * ======================================================================== */

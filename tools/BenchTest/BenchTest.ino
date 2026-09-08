/* ===========================================================================
 *  Aqua-M V2 — BenchTest
 *
 *  A wiring and calibration aid, not part of the robot's firmware. Flash it to
 *  one board at a time, open the Serial Monitor at 115200, and read the raw
 *  numbers before you trust the real sketches.
 *
 *  It answers two open questions from RECOMMENDATIONS.md section A in about
 *  ten minutes each:
 *
 *    - CHECKPOINT_USES_INNER_SENSORS — push the robot along the track by hand
 *      and watch which IR pair goes dark only when crossing a perpendicular
 *      line. That pair is the checkpoint pair.
 *    - TRACK_LINE_WIDE — park the robot centred on the track and read the two
 *      tracking sensors. Both dark means WIDE (1). Both light means the line
 *      passes between them: STRADDLED (0).
 *
 *  Pick the board below, flash, and read the header line for column names.
 *
 *  Board A: soil probe, pH probe, both LDRs, both relays, solar servo.
 *  Board B: four IR sensors, four arm servos. Motors are deliberately NOT
 *           driven here — a bench test that can make the robot move is a bench
 *           test that drives itself off the table.
 * ======================================================================== */

/*  1 = ESP32 A (sensors, pumps, solar)   0 = ESP32 B (IR, arm) */
#ifndef BENCH_BOARD_A
#define BENCH_BOARD_A 1
#endif

#include <Arduino.h>
#include <ESP32Servo.h>

#define SAMPLE_PERIOD_MS 200
#define ADC_SAMPLES       10      // matches averagedAnalogRead() in the firmware

/* --- pin maps: copied from the two sketches, keep them in step ----------- */
#if BENCH_BOARD_A
  #define PIN_SOIL        34
  #define PIN_PH          35
  #define PIN_LDR_LEFT    32
  #define PIN_LDR_RIGHT   33
  #define PIN_RELAY_WATER 26      // active-LOW
  #define PIN_RELAY_FERT  27      // active-LOW
  #define PIN_SERVO_SOLAR 12      // strapping pin: 10k pull-down required
#else
  #define PIN_IR_LEFT_OUTER   34
  #define PIN_IR_LEFT_INNER   35
  #define PIN_IR_RIGHT_INNER  39
  #define PIN_IR_RIGHT_OUTER  36
  #define PIN_SERVO_BASE      25
  #define PIN_SERVO_SHOULDER  26
  #define PIN_SERVO_ELBOW     27
  #define PIN_SERVO_WRIST     32
#endif

/*  Sweep limits. Deliberately narrower than the arm's full travel: this is a
 *  wiring check, not a motion test, and a servo at an unexpected angle with the
 *  probe fitted can hit the frame. */
#define SWEEP_MIN_DEG   60
#define SWEEP_MAX_DEG  120
#define SWEEP_STEP_MS   15

#if BENCH_BOARD_A
Servo solarServo;
bool  waterOn = false, fertOn = false;
#else
Servo servoBase, servoShoulder, servoElbow, servoWrist;
#endif

uint32_t tSample = 0;
bool     streaming = true;

int averagedRead(uint8_t pin) {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(pin);
    delayMicroseconds(500);
  }
  return (int)(sum / ADC_SAMPLES);
}

void printMenu() {
  Serial.println();
  Serial.println(F("--- Aqua-M V2 BenchTest -------------------------------"));
#if BENCH_BOARD_A
  Serial.println(F("  Board: ESP32 A"));
  Serial.println(F("  w : toggle WATER relay      f : toggle FERTILISER relay"));
  Serial.println(F("  s : sweep solar servo 60-120-60 deg"));
  Serial.println(F("  0 : both relays OFF (also runs at boot and on any key)"));
#else
  Serial.println(F("  Board: ESP32 B"));
  Serial.println(F("  1 : sweep BASE      2 : sweep SHOULDER"));
  Serial.println(F("  3 : sweep ELBOW     4 : sweep WRIST"));
  Serial.println(F("  a : sweep all four, one after another"));
  Serial.println(F("  Motors are not driven by this sketch, on purpose."));
#endif
  Serial.println(F("  space : pause / resume the data stream"));
  Serial.println(F("  h : show this menu again"));
  Serial.println(F("-------------------------------------------------------"));
  Serial.println();
  printHeader();
}

void printHeader() {
#if BENCH_BOARD_A
  Serial.println(F("ms\tsoil\tpH\tldrL\tldrR\twater\tfert"));
#else
  Serial.println(F("ms\tirLout\tirLin\tirRin\tirRout\tL_out\tL_in\tR_in\tR_out"));
#endif
}

#if BENCH_BOARD_A
void applyRelays() {
  digitalWrite(PIN_RELAY_WATER, waterOn ? LOW : HIGH);   // active-LOW
  digitalWrite(PIN_RELAY_FERT,  fertOn  ? LOW : HIGH);
}
#endif

void sweep(Servo &s, const char *name) {
  Serial.print(F("[sweep] "));
  Serial.println(name);
  for (int a = SWEEP_MIN_DEG; a <= SWEEP_MAX_DEG; a++) { s.write(a); delay(SWEEP_STEP_MS); }
  for (int a = SWEEP_MAX_DEG; a >= SWEEP_MIN_DEG; a--) { s.write(a); delay(SWEEP_STEP_MS); }
  s.write((SWEEP_MIN_DEG + SWEEP_MAX_DEG) / 2);
  Serial.println(F("[sweep] done, servo parked mid-range"));
}

void setup() {
  Serial.begin(115200);
  delay(300);

#if BENCH_BOARD_A
  /*  Relays first and OFF first, exactly as the real firmware does. */
  pinMode(PIN_RELAY_WATER, OUTPUT);
  pinMode(PIN_RELAY_FERT,  OUTPUT);
  applyRelays();

  analogReadResolution(12);
  ESP32PWM::allocateTimer(0);
  solarServo.setPeriodHertz(50);
  solarServo.attach(PIN_SERVO_SOLAR, 500, 2400);
  solarServo.write(90);
#else
  analogReadResolution(12);
  ESP32PWM::allocateTimer(2);
  ESP32PWM::allocateTimer(3);
  servoBase.setPeriodHertz(50);     servoBase.attach(PIN_SERVO_BASE, 500, 2400);
  servoShoulder.setPeriodHertz(50); servoShoulder.attach(PIN_SERVO_SHOULDER, 500, 2400);
  servoElbow.setPeriodHertz(50);    servoElbow.attach(PIN_SERVO_ELBOW, 500, 2400);
  servoWrist.setPeriodHertz(50);    servoWrist.attach(PIN_SERVO_WRIST, 500, 2400);
  servoBase.write(90); servoShoulder.write(90); servoElbow.write(90); servoWrist.write(90);
#endif

  printMenu();
}

void loop() {
  if (Serial.available()) {
    char c = (char)Serial.read();
    switch (c) {
      case 'h': printMenu(); break;
      case ' ': streaming = !streaming;
                Serial.println(streaming ? F("[stream] resumed") : F("[stream] paused"));
                break;
#if BENCH_BOARD_A
      case 'w': waterOn = !waterOn; applyRelays();
                Serial.println(waterOn ? F("[relay] WATER ON") : F("[relay] WATER off")); break;
      case 'f': fertOn = !fertOn; applyRelays();
                Serial.println(fertOn ? F("[relay] FERT ON") : F("[relay] FERT off")); break;
      case '0': waterOn = fertOn = false; applyRelays();
                Serial.println(F("[relay] both OFF")); break;
      case 's': sweep(solarServo, "solar"); break;
#else
      case '1': sweep(servoBase,     "base");     break;
      case '2': sweep(servoShoulder, "shoulder"); break;
      case '3': sweep(servoElbow,    "elbow");    break;
      case '4': sweep(servoWrist,    "wrist");    break;
      case 'a': sweep(servoBase, "base"); sweep(servoShoulder, "shoulder");
                sweep(servoElbow, "elbow"); sweep(servoWrist, "wrist"); break;
#endif
      default: break;
    }
  }

  if (!streaming) return;
  if (millis() - tSample < SAMPLE_PERIOD_MS) return;
  tSample = millis();

  Serial.print(millis());
#if BENCH_BOARD_A
  Serial.print('\t'); Serial.print(averagedRead(PIN_SOIL));
  Serial.print('\t'); Serial.print(averagedRead(PIN_PH));
  Serial.print('\t'); Serial.print(averagedRead(PIN_LDR_LEFT));
  Serial.print('\t'); Serial.print(averagedRead(PIN_LDR_RIGHT));
  Serial.print('\t'); Serial.print(waterOn ? "ON " : "off");
  Serial.print('\t'); Serial.print(fertOn  ? "ON " : "off");
#else
  int lo = averagedRead(PIN_IR_LEFT_OUTER);
  int li = averagedRead(PIN_IR_LEFT_INNER);
  int ri = averagedRead(PIN_IR_RIGHT_INNER);
  int ro = averagedRead(PIN_IR_RIGHT_OUTER);

  /*  IR_THRESHOLD is 2000 in the firmware: above it counts as black. Printing
   *  the verdict next to the raw value is what makes the two open switch
   *  questions readable at a glance. */
  Serial.print('\t'); Serial.print(lo);
  Serial.print('\t'); Serial.print(li);
  Serial.print('\t'); Serial.print(ri);
  Serial.print('\t'); Serial.print(ro);
  Serial.print('\t'); Serial.print(lo > 2000 ? "BLK" : "wht");
  Serial.print('\t'); Serial.print(li > 2000 ? "BLK" : "wht");
  Serial.print('\t'); Serial.print(ri > 2000 ? "BLK" : "wht");
  Serial.print('\t'); Serial.print(ro > 2000 ? "BLK" : "wht");
#endif
  Serial.println();
}

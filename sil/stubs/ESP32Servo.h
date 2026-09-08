/* Servo stub — records every commanded angle per pin so the arm sequencer and
 * the solar tracker can be asserted against a trace. */
#ifndef AQUAM_SIL_ESP32SERVO_H
#define AQUAM_SIL_ESP32SERVO_H
#include "arduino_stub_prelude.h"

namespace sil {
  struct ServoEvent { uint8_t pin; int angle; uint32_t at_ms; };
  extern std::vector<ServoEvent> servoTrace;
  extern std::map<uint8_t, int>  servoAngle;
}

class ESP32PWM {
 public:
  static void allocateTimer(int) {}
};

class Servo {
 public:
  uint8_t pin = 255;
  void setPeriodHertz(int) {}
  int  attach(uint8_t p, int = 500, int = 2400) { pin = p; return 1; }
  void detach() {}
  void write(int angle) {
    sil::servoAngle[pin] = angle;
    sil::servoTrace.push_back({pin, angle, sil::clock_ms});
  }
  int read() const {
    auto it = sil::servoAngle.find(pin);
    return it == sil::servoAngle.end() ? 0 : it->second;
  }
  bool attached() const { return pin != 255; }
};
#endif

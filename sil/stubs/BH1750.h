/* BH1750 stub — lux is injected per test. A negative value models a failure,
 * which is what the firmware checks for. */
#ifndef AQUAM_SIL_BH1750_H
#define AQUAM_SIL_BH1750_H
#include "arduino_stub_prelude.h"

namespace sil { extern float lux; }

class BH1750 {
 public:
  enum Mode { CONTINUOUS_HIGH_RES_MODE = 0x10, CONTINUOUS_HIGH_RES_MODE_2 = 0x11, ONE_TIME_HIGH_RES_MODE = 0x20 };
  BH1750(uint8_t = 0x23) {}
  bool begin(Mode) { return true; }
  bool begin(Mode, uint8_t) { return true; }
  bool  begin() { return true; }
  bool  begin(int) { return true; }
  float readLightLevel() { return sil::lux; }
};
#endif

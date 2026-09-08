/* I2C is not modelled: the firmware only uses it through the LCD and BH1750
 * objects, both of which are stubbed at a higher level. */
#ifndef AQUAM_SIL_WIRE_H
#define AQUAM_SIL_WIRE_H
#include "arduino_stub_prelude.h"
class SilWire {
 public:
  void begin(int = -1, int = -1) {}
  void setClock(uint32_t) {}
};
extern SilWire Wire;
#endif

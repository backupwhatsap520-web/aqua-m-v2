/* DHT22 stub — readings are injected per test. NAN models a failed read. */
#ifndef AQUAM_SIL_DHT_H
#define AQUAM_SIL_DHT_H
#include "arduino_stub_prelude.h"

#define DHT22 22
#define DHT11 11

namespace sil {
  extern float dhtTemp;      // NAN = sensor failure
  extern float dhtHum;
}

class DHT {
 public:
  DHT(uint8_t, uint8_t) {}
  void  begin() {}
  float readTemperature() { return sil::dhtTemp; }
  float readHumidity()    { return sil::dhtHum; }
};
#endif

/* Definitions for everything the SIL stubs declare extern. */
#include "arduino_stub_prelude.h"
#include "sil_net.h"
#include "FirebaseESP32.h"
#include "DHT.h"
#include "BH1750.h"
#include "LiquidCrystal_I2C.h"
#include "ESP32Servo.h"
#include "Wire.h"
#include "esp_task_wdt.h"

namespace sil {
  uint32_t clock_ms = 0;
  uint64_t clock_us = 0;

  std::vector<PinEvent>      pinTrace;
  std::map<uint8_t, uint8_t> pinState;
  std::map<uint8_t, uint8_t> pinMode_;
  std::map<uint8_t, int>     analogValue;
  std::map<uint8_t, uint8_t> digitalInput;
  std::map<uint8_t, uint32_t> pwmDuty;

  bool             serialEcho = false;
  std::string      serialOut;
  std::deque<char> uartRx;
  std::string      uartTx;

  float dhtTemp = 28.0f;
  float dhtHum  = 60.0f;
  float lux     = 500.0f;

  std::string lcdLine[2];
  int         lcdRow = 0, lcdCol = 0;

  std::vector<ServoEvent> servoTrace;
  std::map<uint8_t, int>  servoAngle;

  uint32_t wdtFeeds  = 0;
  bool     wdtStarted = false;

  namespace net {
    std::deque<Reply>        postQueue;
    std::deque<Reply>        getQueue;
    std::vector<std::string> requests;
    std::vector<std::string> bodies;
    std::function<void(const char *)> guard = [](const char *) {};
    int  wifiStatusValue    = WL_CONNECTED;
    bool firebaseReadyValue = true;
  }

  namespace fb {
    std::vector<Write>                 writes;
    std::map<std::string, std::string> stringDb;
    std::map<std::string, int>         intDb;
    std::map<std::string, bool>        readFails;
    uint32_t                           latencyMs = 0;
  }
}

SilSerial   Serial(false);
SilSerial   Serial2(true);
SilWiFi     WiFi;
SilWire     Wire;
SilFirebase Firebase;

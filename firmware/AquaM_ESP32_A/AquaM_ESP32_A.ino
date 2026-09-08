/*
 * ============================================================================
 *  AQUA-M V2 — ESP32 A  (Control Hub)
 * ----------------------------------------------------------------------------
 *  Responsibilities:
 *    - Read every environmental sensor (soil moisture, pH, DHT22, BH1750, LDR)
 *    - Decide irrigation / fertilisation (Gemini AI online, threshold fallback)
 *    - Drive both relays (water pump, liquid fertiliser pump)
 *    - Drive the 1-axis solar-tracker servo
 *    - Talk to Firebase Realtime Database (logging + remote command)
 *    - Command ESP32 B over UART (navigation + robotic arm)
 *
 *  Board  : ESP32 Dev Module
 *  Scheme : "Huge APP (3MB No OTA / 1MB SPIFFS)"
 *  Serial : 115200
 *
 *  SAFETY NOTE — every blocking network call (Gemini, weather, Firebase) is
 *  only ever issued while BOTH pumps are OFF. The state machine guarantees
 *  this: network work happens in ST_IDLE / ST_DECIDE, pumps only run in
 *  ST_IRRIGATE where no network call is made. enforceActuatorSafety() is a
 *  second, unconditional guard that runs on every single loop iteration.
 * ============================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <FirebaseESP32.h>
#include <ArduinoJson.h>
#include <DHT.h>
#include <BH1750.h>
#include <LiquidCrystal_I2C.h>
#include <ESP32Servo.h>
#include <esp_task_wdt.h>
#include <time.h>

/* ===========================================================================
 *  0. BENCH-TEST SWITCH
 * ======================================================================== */

/*  COOLDOWN SCOPE
 *  0 = ONE cooldown shared by every pot. After watering pot 1, no pot can be
 *      watered for the next 2 minutes. This is the literal reading of the
 *      published 2-minute parameter and is the default.
 *  1 = a separate 2-minute cooldown per pot, so a sweep of all five pots can
 *      water each of them once.
 *  Read RECOMMENDATIONS.md item 23 before changing this — it affects what
 *  the paper describes, so the team should agree first.
 *  Guarded so the build matrix can override it with -DCOOLDOWN_PER_POT=1
 *  without editing this file; the default below is unchanged. */
#ifndef COOLDOWN_PER_POT
#define COOLDOWN_PER_POT 0
#endif

/* ===========================================================================
 *  1. USER CONFIGURATION — edit these before flashing
 * ======================================================================== */
#define WIFI_SSID          "YOUR_WIFI_SSID"
#define WIFI_PASSWORD      "YOUR_WIFI_PASSWORD"

#define FIREBASE_HOST      "https://your-project-default-rtdb.firebaseio.com/"
#define FIREBASE_AUTH      "YOUR_DATABASE_SECRET"

#define GEMINI_API_KEY     "YOUR_GOOGLE_AI_STUDIO_KEY"
#define GEMINI_MODEL       "gemini-2.0-flash"

#define WEATHER_LOCATION   "Jakarta"          // used by wttr.in
#define NTP_SERVER         "pool.ntp.org"
#define GMT_OFFSET_SEC     (7 * 3600)         // WIB = UTC+7
#define DST_OFFSET_SEC     0

/* LCD address. If the display stays blank, change 0x27 to 0x3F. */
#define LCD_I2C_ADDRESS    0x27

/* ===========================================================================
 *  2. PIN MAPPING
 * ======================================================================== */
#define PIN_SOIL           34   // ADC1 - capacitive soil moisture (analog)
#define PIN_PH             35   // ADC1 - soil pH probe (analog)
#define PIN_DHT            15   // DHT22 data
#define PIN_I2C_SDA        21   // LCD + BH1750
#define PIN_I2C_SCL        22
#define PIN_LDR_LEFT       32   // ADC1 - solar tracker
#define PIN_LDR_RIGHT      33   // ADC1 - solar tracker
#define PIN_RELAY_WATER    26   // active-LOW
#define PIN_RELAY_FERT     27   // active-LOW
#define PIN_SERVO_SOLAR    12   // 1-axis panel servo   (see note below)
#define PIN_LED_GREEN      13   // online
#define PIN_LED_YELLOW     14   // offline
#define PIN_LED_RED        18   // sensor / system error
#define PIN_BTN_POT1       25
#define PIN_BTN_POT2       19
#define PIN_BTN_POT3       23
#define PIN_BTN_POT4        5
#define PIN_BTN_POT5        4
#define PIN_UART_RX        16   // <- ESP32 B TX
#define PIN_UART_TX        17   // -> ESP32 B RX

/*  NOTE ON GPIO 12: GPIO12 (MTDI) is a boot strapping pin. If the servo
 *  signal line is pulled HIGH while the board boots, the ESP32 may select the
 *  wrong flash voltage and refuse to start. A 10 kO pull-down to GND on the
 *  servo signal line fixes this. See RECOMMENDATIONS.md. */

/* ===========================================================================
 *  3. CALIBRATION & TIMING CONSTANTS  (locked project parameters)
 * ======================================================================== */
#define SOIL_ADC_DRY       3200      // 0 % moisture
#define SOIL_ADC_WET       1075      // 100 % moisture
#define SOIL_ADC_MIN        700      // below this the probe is shorted / faulty
#define SOIL_ADC_MAX       3800      // above this the probe is disconnected
#define SOIL_DEFAULT_PCT     50      // safe fallback: "moist enough, do not water"

#define PH_ADC_AT_4        2200      // ADC reading in pH 4.0 buffer
#define PH_ADC_AT_9        1500      // ADC reading in pH 9.0 buffer
#define PH_VALID_MIN        3.5f
#define PH_VALID_MAX        9.0f

#define DHT_DEFAULT_TEMP   28.0f
#define DHT_DEFAULT_HUM    60.0f

#define PUMP_MAX_MS        10000UL   // hard ceiling for one irrigation cycle
#define PUMP_COOLDOWN_MS   120000UL  // 2 minutes between waterings
#define FERT_MAX_MS         5000UL   // hard ceiling for one fertiliser cycle

#define THRESH_DRY_PCT       30      // < 30 %  -> 8 s
#define THRESH_MOIST_PCT     60      // 30-60 % -> 4 s ; > 60 % -> off
#define THRESH_DRY_MS      8000UL
#define THRESH_MOIST_MS    4000UL
#define HEAT_TEMP_C        35.0f     // above this add 2 s
#define HEAT_BONUS_MS      2000UL

#define SENSOR_PERIOD_MS    2000UL
#define SOLAR_PERIOD_MS      100UL
#define LCD_PERIOD_MS       1000UL
#define CONNCHECK_PERIOD_MS 30000UL
#define WEATHER_PERIOD_MS  600000UL  // 10 minutes
#define FB_UPLOAD_PERIOD_MS  5000UL
#define FB_COMMAND_PERIOD_MS 3000UL
#define BUTTON_DEBOUNCE_MS    50UL

#define AI_TIMEOUT_MS      15000
#define WEATHER_TIMEOUT_MS  8000

#define SOLAR_TOLERANCE_PCT   5      // deadband to stop servo oscillation
#define SOLAR_STEP_DEG        1
#define SOLAR_MIN_DEG         0
#define SOLAR_MAX_DEG       180

#define MOVE_TIMEOUT_MS    60000UL   // waiting for ARRIVED
#define ARM_TIMEOUT_MS     20000UL   // waiting for SENSOR_READY / LIFTED
#define PROBE_SETTLE_MS     2000UL   // let the probe stabilise in the soil

#define POT_COUNT             5
#define POT_MIN_INDEX         1

/*  The watchdog must outlast the longest blocking call in a single loop
    iteration. The Gemini POST alone can take 15 s, so 30 s leaves headroom
    for a slow Firebase write in the same pass. */
#define WDT_TIMEOUT_S        30

/* ArduinoJson 6 / 7 compatibility ---------------------------------------- */
#if ARDUINOJSON_VERSION_MAJOR >= 7
  #define JSON_DOC(name, size) JsonDocument name
#else
  #define JSON_DOC(name, size) DynamicJsonDocument name(size)
#endif

/* ===========================================================================
 *  4. OBJECTS & GLOBAL STATE
 * ======================================================================== */
DHT dht(PIN_DHT, DHT22);
BH1750 lightMeter;
LiquidCrystal_I2C lcd(LCD_I2C_ADDRESS, 16, 2);
Servo solarServo;

FirebaseData fbdo;
FirebaseAuth fbAuth;
FirebaseConfig fbConfig;

/* --- sensor snapshot ---------------------------------------------------- */
struct SensorData {
  float soilPercent   = SOIL_DEFAULT_PCT;
  bool  soilValid     = false;
  float pH            = 7.0f;
  bool  phValid       = false;
  float temperature   = DHT_DEFAULT_TEMP;
  float humidity      = DHT_DEFAULT_HUM;
  bool  dhtValid      = false;
  float lux           = 0.0f;
  bool  luxValid      = false;
} sensors;

/* --- weather snapshot --------------------------------------------------- */
struct WeatherData {
  String condition = "Unknown";
  float  tempOut   = 0.0f;
  float  humOut    = 0.0f;
  bool   valid     = false;
} weather;

/* --- decision snapshot -------------------------------------------------- */
struct Decision {
  bool     pumpWater        = false;
  uint32_t waterDuration    = 0;
  bool     pumpFertilizer   = false;
  uint32_t fertDuration     = 0;
  String   reason           = "-";
  String   source           = "NONE";   // "AI" | "LOCAL" | "NONE"
  bool     fertilizerDeferred = false;
} decision;

/* --- connectivity ------------------------------------------------------- */
bool wifiOk       = false;
bool firebaseOk   = false;
bool aiAvailable  = true;      // cleared on timeout / 429 / malformed JSON
bool onlineMode   = false;
bool dhtFault     = false;    // DHT22 returned NaN
bool soilFault    = false;    // probe invalid WHILE planted in soil
bool sensorError  = false;    // dhtFault || soilFault — drives the red LED

/* --- robot mirror (reported by ESP32 B over UART) ----------------------- */
int    robotCurrentPot = 1;
bool   robotMoving     = false;
String robotError      = "";
String robotState      = "IDLE";

/* --- actuators ---------------------------------------------------------- */
bool     waterPumpOn   = false;
bool     fertPumpOn    = false;
uint32_t pumpEndMs     = 0;
uint32_t lastPumpStop  = 0;                       // global cooldown reference
uint32_t lastPumpStopPot[POT_COUNT + 1] = {0};    // per-pot, index 1..POT_COUNT

/* --- solar tracker ------------------------------------------------------ */
int solarAngle = 90;

/* --- scheduler timestamps ----------------------------------------------- */
uint32_t tSensor = 0, tSolar = 0, tLcd = 0, tConn = 0,
         tWeather = 0, tUpload = 0, tCommand = 0, tState = 0;

/* --- UART receive buffer ------------------------------------------------ */
String uartBuffer = "";

/* --- buttons ------------------------------------------------------------ */
const uint8_t BUTTON_PINS[POT_COUNT] = {
  PIN_BTN_POT1, PIN_BTN_POT2, PIN_BTN_POT3, PIN_BTN_POT4, PIN_BTN_POT5
};
uint8_t  buttonStable[POT_COUNT]  = {1, 1, 1, 1, 1};
uint8_t  buttonRaw[POT_COUNT]     = {1, 1, 1, 1, 1};
uint32_t buttonChanged[POT_COUNT] = {0, 0, 0, 0, 0};

/* --- mission state machine ---------------------------------------------- */
enum MissionState {
  ST_IDLE,          // nothing to do: housekeeping, network, solar tracking
  ST_MOVE_REQUEST,  // send TARGET:n
  ST_WAIT_ARRIVE,   // wait for ARRIVED:n
  ST_WAIT_SENSOR,   // wait for SENSOR_READY (arm planted)
  ST_SETTLE,        // let the probe stabilise
  ST_READ,          // take the measurement at this pot
  ST_DECIDE,        // AI or local threshold
  ST_IRRIGATE_ON,   // announce + start pumps
  ST_IRRIGATE_RUN,  // pumps running (no network calls here)
  ST_IRRIGATE_OFF,  // pumps off, announce
  ST_LIFT,          // send LIFT
  ST_WAIT_LIFTED,   // wait for LIFTED
  ST_FINISH         // log + return to idle
};
MissionState mission = ST_IDLE;
uint32_t     stateEnteredMs = 0;
int          targetPot = 0;      // 0 = no active mission
bool         missionAborted = false;

/* --- irrigation sub-phase (used inside ST_IRRIGATE_RUN) ----------------- */
enum IrrigPhase { PH_WATER, PH_FERT, PH_DONE };
IrrigPhase irrigPhase = PH_DONE;

/* ===========================================================================
 *  5. FORWARD DECLARATIONS & SMALL HELPERS
 * ======================================================================== */
void startMission(int pot);
void readAllSensors();
void uploadSensors();
void uploadStatus();
void uploadWeather();
void uploadDecision();
void allPumpsOff();
void sendCmd(const String &cmd);
bool probeIsPlanted();
float parseNumber(const String &raw);

void setState(MissionState s) {
  mission = s;
  stateEnteredMs = millis();
}

bool stateTimedOut(uint32_t limitMs) {
  return (millis() - stateEnteredMs) > limitMs;
}

String isoTimestamp() {
  struct tm t;
  if (!getLocalTime(&t, 5)) return String("1970-01-01T00:00:00Z");
  char buf[25];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return String(buf);
}

void sendCmd(const String &cmd) {
  Serial2.print(cmd);
  Serial2.print('\n');
  Serial.print("[TX->B] ");
  Serial.println(cmd);
}

/* ===========================================================================
 *  6. ACTUATOR CONTROL  (relays are ACTIVE-LOW)
 * ======================================================================== */
void setWaterPump(bool on) {
  digitalWrite(PIN_RELAY_WATER, on ? LOW : HIGH);
  if (waterPumpOn && !on) {
    lastPumpStop = millis();
    int p = (targetPot > 0) ? targetPot : robotCurrentPot;
    if (p >= POT_MIN_INDEX && p <= POT_COUNT) lastPumpStopPot[p] = lastPumpStop;
  }
  waterPumpOn = on;
}

void setFertPump(bool on) {
  digitalWrite(PIN_RELAY_FERT, on ? LOW : HIGH);
  fertPumpOn = on;
}

void allPumpsOff() {
  setWaterPump(false);
  setFertPump(false);
  pumpEndMs = 0;
  irrigPhase = PH_DONE;
}

/*  Unconditional watchdog: runs every loop, independent of the state machine.
 *  It can only ever turn actuators OFF, never ON. */
void enforceActuatorSafety() {
  if ((waterPumpOn || fertPumpOn) && pumpEndMs != 0 &&
      (int32_t)(millis() - pumpEndMs) >= 0) {
    setWaterPump(false);
    setFertPump(false);
    pumpEndMs = 0;
  }
}

/*  Which pot the cooldown applies to. During a mission that is the pot the
 *  robot is standing at; otherwise the last known position. */
int activePot() {
  int p = (targetPot > 0) ? targetPot : robotCurrentPot;
  return constrain(p, POT_MIN_INDEX, POT_COUNT);
}

bool cooldownElapsed() {
#if COOLDOWN_PER_POT
  uint32_t last = lastPumpStopPot[activePot()];
#else
  uint32_t last = lastPumpStop;
#endif
  if (last == 0) return true;
  return (millis() - last) >= PUMP_COOLDOWN_MS;
}

/*  True while the probe is actually in the soil. Between missions the arm is
 *  raised and the probe hangs in air, where it always reads out of range —
 *  that is normal, not a fault. */
bool probeIsPlanted() {
  return mission >= ST_SETTLE && mission <= ST_IRRIGATE_OFF;
}

/* ===========================================================================
 *  7. SENSOR READING
 * ======================================================================== */
int averagedAnalogRead(uint8_t pin, uint8_t samples = 10) {
  uint32_t sum = 0;
  for (uint8_t i = 0; i < samples; i++) {
    sum += analogRead(pin);
    delayMicroseconds(500);
  }
  return (int)(sum / samples);
}

void readSoil() {
  int raw = averagedAnalogRead(PIN_SOIL);
  if (raw < SOIL_ADC_MIN || raw > SOIL_ADC_MAX) {
    sensors.soilValid   = false;
    sensors.soilPercent = SOIL_DEFAULT_PCT;   // fail safe: do not irrigate
    return;
  }
  long pct = map(raw, SOIL_ADC_DRY, SOIL_ADC_WET, 0, 100);
  pct = constrain(pct, 0, 100);
  sensors.soilPercent = (float)pct;
  sensors.soilValid   = true;
}

void readPH() {
  int raw = averagedAnalogRead(PIN_PH);
  float value = 4.0f + (9.0f - 4.0f) *
                (float)(raw - PH_ADC_AT_4) / (float)(PH_ADC_AT_9 - PH_ADC_AT_4);
  if (value < PH_VALID_MIN || value > PH_VALID_MAX || isnan(value)) {
    sensors.phValid = false;      // invalid readings are never sent to the AI
  } else {
    sensors.pH      = value;
    sensors.phValid = true;
  }
}

void readDHT() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    if (!sensors.dhtValid) {          // never had a good reading yet
      sensors.temperature = DHT_DEFAULT_TEMP;
      sensors.humidity    = DHT_DEFAULT_HUM;
    }                                  // otherwise keep the last valid values
    sensors.dhtValid = false;
  } else {
    sensors.temperature = t;
    sensors.humidity    = h;
    sensors.dhtValid    = true;
  }
}

void readLight() {
  float lux = lightMeter.readLightLevel();
  if (lux < 0 || isnan(lux)) {
    sensors.luxValid = false;
  } else {
    sensors.lux      = lux;
    sensors.luxValid = true;
  }
}

void readAllSensors() {
  readSoil();
  readPH();
  readDHT();
  readLight();

  /*  Two independent faults, kept separate so the red LED means one thing and
   *  the dashboard can say which sensor is at fault.
   *
   *  dhtFault  — the DHT22 is wired in permanently, so a NaN is always a real
   *              fault, whatever the robot is doing.
   *  soilFault — the moisture probe is on the arm. It only sits in soil while
   *              a mission has it planted; the rest of the time it dangles in
   *              air and reads out of range by design. Judging it outside that
   *              window would leave the red LED on permanently, so it is only
   *              evaluated while probeIsPlanted() is true.
   *
   *  The pH probe is deliberately NOT part of this. An out-of-range pH is
   *  handled by simply not sending the value to the AI; it does not stop
   *  irrigation and does not deserve an error light. */
  dhtFault    = !sensors.dhtValid;
  soilFault   = probeIsPlanted() && !sensors.soilValid;
  sensorError = dhtFault || soilFault;
}

/* ===========================================================================
 *  8. SOLAR TRACKER  (non-blocking, 5 % deadband)
 * ======================================================================== */
void taskSolarTracker() {
  int left  = averagedAnalogRead(PIN_LDR_LEFT, 4);
  int right = averagedAnalogRead(PIN_LDR_RIGHT, 4);

  int   diff      = abs(left - right);
  float reference = (left + right) / 2.0f;
  float tolerance = reference * (SOLAR_TOLERANCE_PCT / 100.0f);
  if (tolerance < 30) tolerance = 30;          // floor for very dark conditions

  if (diff > tolerance) {
    if (left > right && solarAngle < SOLAR_MAX_DEG) solarAngle += SOLAR_STEP_DEG;
    else if (right > left && solarAngle > SOLAR_MIN_DEG) solarAngle -= SOLAR_STEP_DEG;
    solarAngle = constrain(solarAngle, SOLAR_MIN_DEG, SOLAR_MAX_DEG);
    solarServo.write(solarAngle);
  }
}

/* ===========================================================================
 *  9. CONNECTIVITY
 * ======================================================================== */
void taskConnectivity() {
  wifiOk = (WiFi.status() == WL_CONNECTED);
  if (!wifiOk) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);     // non-blocking retry
    firebaseOk = false;
  } else {
    firebaseOk = Firebase.ready();
  }
  onlineMode = wifiOk && firebaseOk;

  digitalWrite(PIN_LED_GREEN,  onlineMode ? HIGH : LOW);
  digitalWrite(PIN_LED_YELLOW, onlineMode ? LOW  : HIGH);
  digitalWrite(PIN_LED_RED,    (sensorError || robotError.length() > 0) ? HIGH : LOW);

  if (onlineMode) aiAvailable = true;         // allow AI to be retried
}

/* ===========================================================================
 * 10. WEATHER — wttr.in compact format (tiny payload, easy to parse)
 *     https://wttr.in/Jakarta?format=%C|%t|%h   ->  "Partly cloudy|+29C|70%"
 * ======================================================================== */
/*  Keeps only the characters that can be part of a number and drops
 *  everything else — the degree sign (two bytes in UTF-8), unit letters,
 *  stray whitespace. Whatever wttr.in or the core does with the degree
 *  symbol, the number survives. */
float parseNumber(const String &raw) {
  String digits;
  for (unsigned int i = 0; i < raw.length(); i++) {
    char c = raw[i];
    if ((c >= '0' && c <= '9') || c == '-' || c == '+' || c == '.') digits += c;
  }
  if (digits.length() == 0) return NAN;
  return digits.toFloat();
}

void fetchWeather() {
  if (!wifiOk) return;

  WiFiClientSecure client;
  client.setInsecure();                       // see RECOMMENDATIONS.md
  HTTPClient http;
  String url = String("https://wttr.in/") + WEATHER_LOCATION +
               "?format=%25C%7C%25t%7C%25h&m";
  http.setTimeout(WEATHER_TIMEOUT_MS);
  if (!http.begin(client, url)) return;
  http.addHeader("User-Agent", "curl/7.88.1");   // wttr.in needs a plain UA

  int code = http.GET();
  if (code == HTTP_CODE_OK) {
    String body = http.getString();
    body.trim();
    int p1 = body.indexOf('|');
    int p2 = body.indexOf('|', p1 + 1);
    if (p1 > 0 && p2 > p1) {
      weather.condition = body.substring(0, p1);
      float t = parseNumber(body.substring(p1 + 1, p2));
      float h = parseNumber(body.substring(p2 + 1));
      if (!isnan(t)) weather.tempOut = t;
      if (!isnan(h)) weather.humOut  = h;
      weather.valid = !isnan(t);        // condition alone is not enough
      Serial.println("[WEATHER] " + weather.condition + " " +
                     String(weather.tempOut, 1) + "C " +
                     String(weather.humOut, 0) + "%");
    }
  } else {
    Serial.printf("[WEATHER] HTTP %d\n", code);
  }
  http.end();
}

/* ===========================================================================
 * 11. GEMINI AI DECISION
 * ======================================================================== */
String buildPrompt() {
  String p;
  p += "You control an autonomous multi-pot irrigation robot. ";
  p += "Decide whether to water and whether to apply liquid fertiliser for ";
  p += "the plant in front of the robot right now.\n\n";
  p += "READINGS\n";
  p += "- pot_number: " + String(targetPot > 0 ? targetPot : robotCurrentPot) + "\n";
  p += "- soil_moisture_percent: " + String(sensors.soilPercent, 1) +
       (sensors.soilValid ? "" : " (SENSOR INVALID - be conservative)") + "\n";
  p += "- air_temperature_c: " + String(sensors.temperature, 1) + "\n";
  p += "- air_humidity_percent: " + String(sensors.humidity, 1) + "\n";
  if (sensors.phValid) p += "- soil_ph: " + String(sensors.pH, 2) + "\n";
  else                 p += "- soil_ph: unavailable\n";
  if (sensors.luxValid) p += "- light_lux: " + String(sensors.lux, 0) + "\n";
  if (weather.valid) {
    p += "- weather_now: " + weather.condition + "\n";
    p += "- outdoor_temperature_c: " + String(weather.tempOut, 1) + "\n";
    p += "- outdoor_humidity_percent: " + String(weather.humOut, 0) + "\n";
  } else {
    p += "- weather_now: unavailable\n";
  }
  uint32_t sinceMin = (lastPumpStop == 0) ? 999 : (millis() - lastPumpStop) / 60000UL;
  p += "- minutes_since_last_watering: " + String(sinceMin) + "\n\n";
  p += "RULES\n";
  p += "1. water_duration is milliseconds, 0 to 10000. 0 means do not water.\n";
  p += "2. fertilizer_duration is milliseconds, 0 to 5000. 0 means do not fertilise.\n";
  p += "3. Do not water if soil moisture is above 60 percent.\n";
  p += "4. Do not water if rain is falling or clearly imminent.\n";
  p += "5. Only fertilise if soil pH is available and the plant is not water stressed.\n";
  p += "6. Keep reason under 90 characters.\n\n";
  p += "Reply with raw JSON only, no markdown, no code fence:\n";
  p += "{\"pump_water\":bool,\"water_duration\":int,\"pump_fertilizer\":bool,";
  p += "\"fertilizer_duration\":int,\"reason\":\"string\"}";
  return p;
}

/*  Strips ``` fences and returns the substring between the first '{' and the
 *  last '}' so that a chatty model still parses cleanly. */
String extractJsonObject(const String &raw) {
  int start = raw.indexOf('{');
  int end   = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return String("");
  return raw.substring(start, end + 1);
}

bool callGeminiAI() {
  if (!wifiOk) return false;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;
  String url = String("https://generativelanguage.googleapis.com/v1beta/models/") +
               GEMINI_MODEL + ":generateContent?key=" + GEMINI_API_KEY;

  http.setTimeout(AI_TIMEOUT_MS);
  if (!http.begin(client, url)) return false;
  http.addHeader("Content-Type", "application/json");

  JSON_DOC(req, 2048);
  req["contents"][0]["parts"][0]["text"] = buildPrompt();
  req["generationConfig"]["temperature"]      = 0.2;
  req["generationConfig"]["maxOutputTokens"]  = 256;
  req["generationConfig"]["responseMimeType"] = "application/json";

  String body;
  serializeJson(req, body);

  int code = http.POST(body);
  if (code != HTTP_CODE_OK) {
    Serial.printf("[AI] HTTP %d -> fallback\n", code);
    http.end();
    aiAvailable = false;                        // covers 429 / 5xx / timeout
    return false;
  }

  String payload = http.getString();
  http.end();

  JSON_DOC(res, 8192);
  if (deserializeJson(res, payload) != DeserializationError::Ok) {
    Serial.println("[AI] envelope parse failed -> fallback");
    aiAvailable = false;
    return false;
  }

  const char *text = res["candidates"][0]["content"]["parts"][0]["text"];
  if (text == nullptr) {
    Serial.println("[AI] no text part -> fallback");
    aiAvailable = false;
    return false;
  }

  String inner = extractJsonObject(String(text));
  if (inner.length() == 0) {
    Serial.println("[AI] malformed inner JSON -> fallback");
    aiAvailable = false;
    return false;
  }

  JSON_DOC(dec, 1024);
  if (deserializeJson(dec, inner) != DeserializationError::Ok) {
    Serial.println("[AI] decision parse failed -> fallback");
    aiAvailable = false;
    return false;
  }

  decision.pumpWater      = dec["pump_water"] | false;
  decision.waterDuration  = dec["water_duration"] | 0;
  decision.pumpFertilizer = dec["pump_fertilizer"] | false;
  decision.fertDuration   = dec["fertilizer_duration"] | 0;
  decision.reason         = String((const char *)(dec["reason"] | "AI decision"));
  decision.source         = "AI";
  decision.fertilizerDeferred = false;

  /* Firmware always has the last word on duration limits. */
  decision.waterDuration = constrain((long)decision.waterDuration, 0L, (long)PUMP_MAX_MS);
  decision.fertDuration  = constrain((long)decision.fertDuration,  0L, (long)FERT_MAX_MS);
  if (decision.waterDuration == 0) decision.pumpWater      = false;
  if (decision.fertDuration  == 0) decision.pumpFertilizer = false;

  aiAvailable = true;
  Serial.println("[AI] " + decision.reason);
  return true;
}

/* ===========================================================================
 * 12. LOCAL THRESHOLD DECISION (irrigation only — fertiliser is deferred)
 * ======================================================================== */
void localThresholdDecision() {
  uint32_t duration = 0;
  float m = sensors.soilPercent;

  if (m < THRESH_DRY_PCT)        duration = THRESH_DRY_MS;
  else if (m <= THRESH_MOIST_PCT) duration = THRESH_MOIST_MS;
  else                            duration = 0;

  if (duration > 0 && sensors.temperature > HEAT_TEMP_C) duration += HEAT_BONUS_MS;
  duration = constrain((long)duration, 0L, (long)PUMP_MAX_MS);

  decision.pumpWater      = (duration > 0);
  decision.waterDuration  = duration;
  decision.pumpFertilizer = false;             // NO local fertiliser rule
  decision.fertDuration   = 0;
  decision.fertilizerDeferred = true;
  decision.source         = "LOCAL";
  decision.reason         = duration > 0
      ? String("Local threshold: soil ") + String(m, 0) + "%"
      : String("Local threshold: soil moist enough");
}

void makeDecision() {
  bool decided = false;
  if (onlineMode && aiAvailable) decided = callGeminiAI();
  if (!decided) localThresholdDecision();

  /*  Guards applied to both paths.
   *
   *  The cooldown blocks BOTH pumps, not just the water pump. Liquid
   *  fertiliser is still liquid going into the same pot: letting it through
   *  during a water cooldown would deliver up to 5 s of liquid to a medium
   *  the firmware has just decided is too recently wetted. Fertiliser is
   *  deferred rather than cancelled, so it can be applied on the next visit.
   *
   *  With COOLDOWN_PER_POT 0 this cooldown is shared by all five pots — see
   *  RECOMMENDATIONS.md item 23, it will be visible on your first sweep. */
  if (!cooldownElapsed()) {
    decision.pumpWater          = false;
    decision.waterDuration      = 0;
    decision.pumpFertilizer     = false;
    decision.fertDuration       = 0;
    decision.fertilizerDeferred = true;
    decision.reason             = "Pump cooldown active, both pumps held";
  }

  /*  An invalid probe reading stops irrigation outright. Fertiliser goes with
   *  it: a nutrient dose chosen from a reading we do not trust is worse than
   *  no dose at all. */
  if (!sensors.soilValid) {
    decision.pumpWater          = false;
    decision.waterDuration      = 0;
    decision.pumpFertilizer     = false;
    decision.fertDuration       = 0;
    decision.fertilizerDeferred = true;
    decision.reason             = "Soil probe invalid, nothing applied";
  }
}

/* ===========================================================================
 * 13. FIREBASE
 * ======================================================================== */
void uploadSensors() {
  if (!onlineMode) return;
  FirebaseJson j;
  j.set("soil_moisture", sensors.soilPercent);
  j.set("temperature",   sensors.temperature);
  j.set("humidity",      sensors.humidity);
  j.set("pH",            sensors.phValid ? sensors.pH : -1.0f);
  j.set("light_intensity", sensors.lux);
  j.set("timestamp",     isoTimestamp());
  Firebase.updateNode(fbdo, "/device/esp32_a/sensors", j);
}

void uploadWeather() {
  if (!onlineMode || !weather.valid) return;
  FirebaseJson j;
  j.set("condition",    weather.condition);
  j.set("temp_out",     weather.tempOut);
  j.set("humidity_out", weather.humOut);
  j.set("timestamp",    isoTimestamp());
  Firebase.updateNode(fbdo, "/device/esp32_a/weather", j);
}

void uploadDecision() {
  if (!onlineMode) return;
  FirebaseJson j;
  j.set("pump_water",         decision.pumpWater);
  j.set("water_duration",     (int)decision.waterDuration);
  j.set("pump_fertilizer",    decision.pumpFertilizer);
  j.set("fertilizer_duration", (int)decision.fertDuration);
  j.set("fertilizer_deferred", decision.fertilizerDeferred);
  j.set("reason",             decision.reason);
  j.set("timestamp",          isoTimestamp());
  Firebase.updateNode(fbdo, "/device/esp32_a/ai_decision", j);
}

void uploadStatus() {
  if (!onlineMode) return;
  FirebaseJson a;
  a.set("mode",            onlineMode ? "ONLINE" : "OFFLINE");
  a.set("pump_active",     waterPumpOn || fertPumpOn);
  a.set("internet",        wifiOk);
  a.set("ai_available",    aiAvailable);
  a.set("decision_source", decision.source);
  a.set("mission_state",   (int)mission);
  a.set("dht_fault",       dhtFault);
  a.set("soil_fault",      soilFault);
  Firebase.updateNode(fbdo, "/device/esp32_a/status", a);

  FirebaseJson b;                              // ESP32 B has no WiFi: A mirrors it
  b.set("current_pot", robotCurrentPot);
  b.set("moving",      robotMoving);
  b.set("connection",  onlineMode ? "online" : "offline");
  b.set("error",       robotError);
  Firebase.updateNode(fbdo, "/device/esp32_b/status", b);
}

/*  Remote command from the dashboard. */
void pollFirebaseCommand() {
  if (!onlineMode || mission != ST_IDLE) return;

  String action;
  if (Firebase.getString(fbdo, "/device/esp32_a/command/action")) {
    action = fbdo.stringData();
  }

  if (action == "stop") {
    sendCmd("STOP");
    allPumpsOff();
    Firebase.setString(fbdo, "/device/esp32_a/command/action", "idle");
    return;
  }
  if (action == "return") {
    Firebase.setString(fbdo, "/device/esp32_a/command/action", "idle");
    Firebase.setInt(fbdo, "/device/esp32_a/command/target_pot", 1);
    startMission(1);
    return;
  }

  int pot = 0;
  if (Firebase.getInt(fbdo, "/device/esp32_a/command/target_pot", &pot)) {
    if (pot >= 1 && pot <= POT_COUNT && pot != robotCurrentPot) startMission(pot);
  }
}

/* ===========================================================================
 * 14. UART LINK TO ESP32 B
 * ======================================================================== */
void handleUartLine(String line) {
  line.trim();
  if (line.length() == 0) return;
  Serial.print("[RX<-B] ");
  Serial.println(line);

  if (line == "MOVING") {
    robotMoving = true;
    robotState  = "MOVING";
  } else if (line.startsWith("ARRIVED:")) {
    robotCurrentPot = line.substring(8).toInt();
    robotMoving     = false;
    robotState      = "ARRIVED";
    if (mission == ST_WAIT_ARRIVE) setState(ST_WAIT_SENSOR);
  } else if (line == "SENSOR_READY") {
    robotState = "PLANTED";
    if (mission == ST_WAIT_SENSOR) setState(ST_SETTLE);
  } else if (line == "LIFTED") {
    robotState = "LIFTED";
    if (mission == ST_WAIT_LIFTED) setState(ST_FINISH);
  } else if (line == "IDLE") {
    robotState  = "IDLE";
    robotMoving = false;
  } else if (line.startsWith("ERROR:")) {
    robotError = line.substring(6);
    robotState = "ERROR";
    missionAborted = true;
  }
}

void handleUartRx() {
  while (Serial2.available()) {
    char c = (char)Serial2.read();
    if (c == '\n') {
      handleUartLine(uartBuffer);
      uartBuffer = "";
    } else if (c != '\r') {
      if (uartBuffer.length() < 96) uartBuffer += c;
      else uartBuffer = "";                    // overflow guard
    }
  }
}

/* ===========================================================================
 * 15. BUTTONS  (INPUT_PULLUP, 50 ms debounce)
 * ======================================================================== */
void startMission(int pot) {
  if (mission != ST_IDLE) return;
  targetPot      = pot;
  missionAborted = false;
  robotError     = "";
  setState(ST_MOVE_REQUEST);
  Serial.printf("[MISSION] start -> pot %d\n", pot);
}

void taskButtons() {
  for (uint8_t i = 0; i < POT_COUNT; i++) {
    uint8_t reading = digitalRead(BUTTON_PINS[i]);
    if (reading != buttonRaw[i]) {
      buttonRaw[i]     = reading;
      buttonChanged[i] = millis();
    }
    if ((millis() - buttonChanged[i]) > BUTTON_DEBOUNCE_MS &&
        buttonStable[i] != buttonRaw[i]) {
      buttonStable[i] = buttonRaw[i];
      if (buttonStable[i] == LOW) startMission(i + 1);   // pressed
    }
  }
}

/* ===========================================================================
 * 16. LCD
 * ======================================================================== */
void taskLcd() {
  lcd.setCursor(0, 0);
  char l0[17];
  snprintf(l0, sizeof(l0), "S:%3d%% T:%4.1fC",
           (int)sensors.soilPercent, sensors.temperature);
  lcd.print(l0);
  for (int i = strlen(l0); i < 16; i++) lcd.print(' ');

  lcd.setCursor(0, 1);
  char l1[17];
  const char *md = onlineMode ? "ON " : "OFF";
  const char *pm = waterPumpOn ? "W" : (fertPumpOn ? "F" : "-");
  snprintf(l1, sizeof(l1), "%s P%d %s %s",
           md, robotCurrentPot, pm, decision.source.c_str());
  lcd.print(l1);
  for (int i = strlen(l1); i < 16; i++) lcd.print(' ');
}

/* ===========================================================================
 * 17. MISSION STATE MACHINE
 * ======================================================================== */
void abortMission(const char *why) {
  Serial.printf("[MISSION] aborted: %s\n", why);
  allPumpsOff();
  sendCmd("LIFT");
  targetPot = 0;
  missionAborted = false;
  setState(ST_IDLE);
}

void runMission() {
  if (missionAborted && mission != ST_IDLE) {
    abortMission("ESP32 B reported an error");
    return;
  }

  switch (mission) {

    case ST_IDLE:
      break;                                    // housekeeping runs in loop()

    case ST_MOVE_REQUEST:
      sendCmd(String("TARGET:") + targetPot);
      setState(ST_WAIT_ARRIVE);
      break;

    case ST_WAIT_ARRIVE:
      if (stateTimedOut(MOVE_TIMEOUT_MS)) abortMission("move timeout");
      break;

    case ST_WAIT_SENSOR:
      if (stateTimedOut(ARM_TIMEOUT_MS)) abortMission("arm timeout");
      break;

    case ST_SETTLE:
      if (stateTimedOut(PROBE_SETTLE_MS)) setState(ST_READ);
      break;

    case ST_READ:
      readAllSensors();
      setState(ST_DECIDE);
      break;

    case ST_DECIDE:                             // may block up to AI_TIMEOUT_MS
      makeDecision();                           // pumps are OFF here, by design
      uploadDecision();
      setState(ST_IRRIGATE_ON);
      break;

    case ST_IRRIGATE_ON:
      if (!decision.pumpWater && !decision.pumpFertilizer) {
        setState(ST_LIFT);                      // nothing to do at this pot
        break;
      }
      sendCmd("IRRIGATE_ON");
      if (decision.pumpWater) {
        setWaterPump(true);
        pumpEndMs  = millis() + decision.waterDuration;
        irrigPhase = PH_WATER;
      } else {
        setFertPump(true);
        pumpEndMs  = millis() + decision.fertDuration;
        irrigPhase = PH_FERT;
      }
      setState(ST_IRRIGATE_RUN);
      break;

    case ST_IRRIGATE_RUN:
      if (waterPumpOn || fertPumpOn) break;     // safety guard turns them off
      if (irrigPhase == PH_WATER && decision.pumpFertilizer) {
        setFertPump(true);                      // fertiliser follows water
        pumpEndMs  = millis() + decision.fertDuration;
        irrigPhase = PH_FERT;
        break;
      }
      irrigPhase = PH_DONE;
      setState(ST_IRRIGATE_OFF);
      break;

    case ST_IRRIGATE_OFF:
      allPumpsOff();
      sendCmd("IRRIGATE_OFF");
      setState(ST_LIFT);
      break;

    case ST_LIFT:
      sendCmd("LIFT");
      setState(ST_WAIT_LIFTED);
      break;

    case ST_WAIT_LIFTED:
      if (stateTimedOut(ARM_TIMEOUT_MS)) abortMission("lift timeout");
      break;

    case ST_FINISH:
      uploadSensors();
      uploadStatus();
      targetPot = 0;
      setState(ST_IDLE);
      Serial.println("[MISSION] complete");
      break;
  }
}

/* ===========================================================================
 * 17b. HARDWARE WATCHDOG
 *      Recovers the board if a network library ever hangs instead of timing
 *      out. The timeout is deliberately longer than the slowest blocking call
 *      (the 15 s Gemini POST) so a slow API is not mistaken for a lock-up.
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
 * 18. SETUP
 * ======================================================================== */
void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, PIN_UART_RX, PIN_UART_TX);
  delay(200);
  Serial.println("\n[BOOT] Aqua-M V2 — ESP32 A");

  /* Relays first: guarantee both pumps are OFF before anything else. */
  pinMode(PIN_RELAY_WATER, OUTPUT);
  pinMode(PIN_RELAY_FERT,  OUTPUT);
  digitalWrite(PIN_RELAY_WATER, HIGH);
  digitalWrite(PIN_RELAY_FERT,  HIGH);

  pinMode(PIN_LED_GREEN,  OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED,    OUTPUT);
  for (uint8_t i = 0; i < POT_COUNT; i++) pinMode(BUTTON_PINS[i], INPUT_PULLUP);

  analogReadResolution(12);
  analogSetPinAttenuation(PIN_SOIL,      ADC_11db);
  analogSetPinAttenuation(PIN_PH,        ADC_11db);
  analogSetPinAttenuation(PIN_LDR_LEFT,  ADC_11db);
  analogSetPinAttenuation(PIN_LDR_RIGHT, ADC_11db);

  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("Aqua-M V2");
  lcd.setCursor(0, 1); lcd.print("Starting...");

  dht.begin();
  if (!lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("[BOOT] BH1750 not found");
  }

  ESP32PWM::allocateTimer(0);
  solarServo.setPeriodHertz(50);
  solarServo.attach(PIN_SERVO_SOLAR, 500, 2400);
  solarServo.write(solarAngle);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 12000) delay(250);
  wifiOk = (WiFi.status() == WL_CONNECTED);
  Serial.println(wifiOk ? "[BOOT] WiFi connected" : "[BOOT] WiFi failed, offline mode");

  if (wifiOk) configTime(GMT_OFFSET_SEC, DST_OFFSET_SEC, NTP_SERVER);

  fbConfig.database_url = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &fbAuth);
  Firebase.reconnectWiFi(true);
  fbdo.setBSSLBufferSize(2048, 1024);
  fbdo.setResponseSize(4096);

  readAllSensors();
  taskConnectivity();
  if (onlineMode) fetchWeather();

  lcd.clear();
  watchdogBegin();
  Serial.println("[BOOT] ready");
}

/* ===========================================================================
 * 19. MAIN LOOP — cooperative scheduler, no delay() anywhere
 * ======================================================================== */
void loop() {
  uint32_t now = millis();

  esp_task_wdt_reset();         // 0. feed the hardware watchdog
  enforceActuatorSafety();      // 1. unconditional actuator watchdog
  handleUartRx();               // 2. drain the link to ESP32 B
  taskButtons();                // 3. local pot selection

  if (now - tSolar >= SOLAR_PERIOD_MS)   { tSolar = now;  taskSolarTracker(); }
  if (now - tSensor >= SENSOR_PERIOD_MS) { tSensor = now; readAllSensors();   }
  if (now - tLcd >= LCD_PERIOD_MS)       { tLcd = now;    taskLcd();          }
  if (now - tConn >= CONNCHECK_PERIOD_MS){ tConn = now;   taskConnectivity(); }

  /* Network work is confined to the idle state so it can never delay a
     running pump. */
  if (mission == ST_IDLE) {
    if (now - tWeather >= WEATHER_PERIOD_MS) { tWeather = now; fetchWeather(); uploadWeather(); }
    if (now - tUpload  >= FB_UPLOAD_PERIOD_MS){ tUpload  = now; uploadSensors(); uploadStatus(); }
    if (now - tCommand >= FB_COMMAND_PERIOD_MS){ tCommand = now; pollFirebaseCommand(); }
  }

  runMission();                 // 4. advance the mission state machine
}

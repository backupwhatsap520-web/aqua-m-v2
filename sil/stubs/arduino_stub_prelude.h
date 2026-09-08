/* ===========================================================================
 *  Aqua-M V2 — SIL harness, Arduino core stubs
 *
 *  Software-in-the-loop only. Nothing here runs on an ESP32 and nothing here
 *  measures hardware. It exists so the real .ino can be compiled and driven on
 *  a host, with time, sensors and the network under the test's control.
 *
 *  Must be included before the sketch. See brief §7.1.
 * ======================================================================== */
#ifndef AQUAM_SIL_ARDUINO_STUB_PRELUDE_H
#define AQUAM_SIL_ARDUINO_STUB_PRELUDE_H

#include <cstdint>
#include <cstdio>
#include <cstdarg>
#include <cstring>
#include <cstdlib>
#include <cmath>
#include <string>
#include <vector>
#include <deque>
#include <map>
#include <functional>
#include <algorithm>

/* --- basic Arduino types ------------------------------------------------- */
typedef uint8_t byte;
typedef bool boolean;

#define HIGH 1
#define LOW  0
#define INPUT        0x01
#define OUTPUT       0x03
#define INPUT_PULLUP 0x05
#define SERIAL_8N1   0x800001c

#define PROGMEM
#define F(x) (x)

/* ===========================================================================
 *  VIRTUAL CLOCK — the most important stub (§7.2).
 *  Time only moves when a test says so, so a 120 s cooldown costs one call.
 * ======================================================================== */
namespace sil {
  extern uint32_t clock_ms;
  extern uint64_t clock_us;

  inline void advance(uint32_t ms) {
    clock_ms += ms;
    clock_us += (uint64_t)ms * 1000ULL;
  }
  inline void setClock(uint32_t ms) { clock_ms = ms; clock_us = (uint64_t)ms * 1000ULL; }
}

inline uint32_t millis() { return sil::clock_ms; }
inline uint32_t micros() { return (uint32_t)sil::clock_us; }

/*  delay() advances the virtual clock rather than sleeping. The firmware
 *  claims "no delay() anywhere" in loop(); any delay that does run is still
 *  accounted for so timing assertions stay honest. */
inline void delay(uint32_t ms) { sil::advance(ms); }
inline void delayMicroseconds(uint32_t us) {
  sil::clock_us += us;
  sil::clock_ms = (uint32_t)(sil::clock_us / 1000ULL);
}
inline void yield() {}

/* ===========================================================================
 *  String — minimal but covering everything the firmware uses (§7.2).
 * ======================================================================== */
class String {
 public:
  std::string s;

  String() {}
  String(const char *p) : s(p ? p : "") {}
  String(const std::string &p) : s(p) {}
  String(char c) : s(1, c) {}
  String(int v) { char b[24]; snprintf(b, sizeof(b), "%d", v); s = b; }
  String(unsigned int v) { char b[24]; snprintf(b, sizeof(b), "%u", v); s = b; }
  String(long v) { char b[32]; snprintf(b, sizeof(b), "%ld", v); s = b; }
  String(unsigned long v) { char b[32]; snprintf(b, sizeof(b), "%lu", v); s = b; }
  String(float v, int dec = 2) { char b[40]; snprintf(b, sizeof(b), "%.*f", dec, (double)v); s = b; }
  String(double v, int dec = 2) { char b[40]; snprintf(b, sizeof(b), "%.*f", dec, v); s = b; }

  const char *c_str() const { return s.c_str(); }
  unsigned int length() const { return (unsigned int)s.size(); }
  bool isEmpty() const { return s.empty(); }

  String &operator+=(const String &o) { s += o.s; return *this; }
  String &operator+=(const char *o)   { s += (o ? o : ""); return *this; }
  String &operator+=(char c)          { s += c; return *this; }

  friend String operator+(String a, const String &b) { a.s += b.s; return a; }
  friend String operator+(String a, const char *b)   { a.s += (b ? b : ""); return a; }
  friend String operator+(const char *a, const String &b) { return String(a) + b; }

  bool operator==(const String &o) const { return s == o.s; }
  bool operator==(const char *o) const { return s == (o ? o : ""); }
  bool operator!=(const String &o) const { return !(*this == o); }
  bool operator!=(const char *o) const { return !(*this == o); }

  char operator[](unsigned int i) const { return i < s.size() ? s[i] : '\0'; }
  char &operator[](unsigned int i) { return s[i]; }

  int indexOf(char c, unsigned int from = 0) const {
    size_t p = s.find(c, from); return p == std::string::npos ? -1 : (int)p;
  }
  int indexOf(const char *t, unsigned int from = 0) const {
    size_t p = s.find(t, from); return p == std::string::npos ? -1 : (int)p;
  }
  int indexOf(const String &t, unsigned int from = 0) const { return indexOf(t.c_str(), from); }

  int lastIndexOf(char c) const {
    size_t p = s.rfind(c); return p == std::string::npos ? -1 : (int)p;
  }
  int lastIndexOf(const char *t) const {
    size_t p = s.rfind(t); return p == std::string::npos ? -1 : (int)p;
  }

  String substring(unsigned int from) const {
    if (from >= s.size()) return String();
    return String(s.substr(from));
  }
  String substring(unsigned int from, unsigned int to) const {
    if (from >= s.size() || to <= from) return String();
    if (to > s.size()) to = (unsigned int)s.size();
    return String(s.substr(from, to - from));
  }

  bool startsWith(const char *p) const { return s.rfind(p, 0) == 0; }
  bool startsWith(const String &p) const { return startsWith(p.c_str()); }
  bool endsWith(const char *p) const {
    size_t n = strlen(p);
    return s.size() >= n && s.compare(s.size() - n, n, p) == 0;
  }

  void trim() {
    size_t b = s.find_first_not_of(" \t\r\n");
    size_t e = s.find_last_not_of(" \t\r\n");
    s = (b == std::string::npos) ? "" : s.substr(b, e - b + 1);
  }
  void replace(const char *from, const char *to) {
    if (!from || !*from) return;
    size_t p = 0, n = strlen(from), m = strlen(to ? to : "");
    while ((p = s.find(from, p)) != std::string::npos) { s.replace(p, n, to ? to : ""); p += m; }
  }
  void replace(const String &from, const String &to) { replace(from.c_str(), to.c_str()); }
  void toUpperCase() { for (auto &c : s) c = (char)toupper((unsigned char)c); }
  void toLowerCase() { for (auto &c : s) c = (char)tolower((unsigned char)c); }

  float toFloat() const { return (float)atof(s.c_str()); }
  double toDouble() const { return atof(s.c_str()); }
  long toInt() const { return atol(s.c_str()); }

  /*  ArduinoJson's Writer<::String> assigns a null const char* to clear the
   *  string and then calls concat() repeatedly, so both must exist and concat
   *  must report success. */
  String &operator=(const char *p) { s = p ? p : ""; return *this; }
  unsigned char concat(const char *p) { if (p) s += p; return 1; }
  unsigned char concat(const String &o) { s += o.s; return 1; }
  unsigned char concat(char c) { s += c; return 1; }

  /*  Its Reader<::String> walks the string through these. */
  int read() { if (readPos_ >= s.size()) return -1; return (unsigned char)s[readPos_++]; }
  int peek() const { return readPos_ >= s.size() ? -1 : (unsigned char)s[readPos_]; }
  size_t readBytes(char *buf, size_t len) {
    size_t n = 0;
    while (n < len && readPos_ < s.size()) buf[n++] = s[readPos_++];
    return n;
  }
  int available() const { return (int)(s.size() - readPos_); }

 private:
  size_t readPos_ = 0;
};

/* ===========================================================================
 *  GPIO — every write is recorded so tests can assert on the trace (§7.2).
 * ======================================================================== */
namespace sil {
  struct PinEvent { uint8_t pin; uint8_t level; uint32_t at_ms; };

  extern std::vector<PinEvent>        pinTrace;
  extern std::map<uint8_t, uint8_t>   pinState;    // last level written
  extern std::map<uint8_t, uint8_t>   pinMode_;
  extern std::map<uint8_t, int>       analogValue; // injected per pin
  extern std::map<uint8_t, uint8_t>   digitalInput;

  inline void resetPins() {
    pinTrace.clear(); pinState.clear(); pinMode_.clear();
    analogValue.clear(); digitalInput.clear();
  }
  inline void setAnalog(uint8_t pin, int v) { analogValue[pin] = v; }
  inline void setDigitalIn(uint8_t pin, uint8_t v) { digitalInput[pin] = v; }
  inline uint8_t levelOf(uint8_t pin) {
    auto it = pinState.find(pin);
    return it == pinState.end() ? 0xFF : it->second;   // 0xFF = never written
  }
}

inline void pinMode(uint8_t pin, uint8_t mode) { sil::pinMode_[pin] = mode; }

inline void digitalWrite(uint8_t pin, uint8_t level) {
  sil::pinState[pin] = level;
  sil::pinTrace.push_back({pin, level, sil::clock_ms});
}

inline int digitalRead(uint8_t pin) {
  auto it = sil::digitalInput.find(pin);
  return it == sil::digitalInput.end() ? HIGH : it->second;   // idle-high buttons
}

inline int analogRead(uint8_t pin) {
  auto it = sil::analogValue.find(pin);
  return it == sil::analogValue.end() ? 0 : it->second;
}

inline void analogReadResolution(uint8_t) {}
inline void analogSetPinAttenuation(uint8_t, int) {}
#define ADC_11db 3
#define ADC_ATTEN_DB_12 3

/* --- maths helpers ------------------------------------------------------- */
inline long map(long x, long in_min, long in_max, long out_min, long out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

/*  Arduino's constrain() is a macro, so it happily mixes types. As a template
 *  it would not deduce for constrain(long, int, int), which the firmware does
 *  in several places, so the arguments are promoted to a common type first. */
template <typename A, typename B, typename C>
inline typename std::common_type<A, B, C>::type constrain(A v, B lo, C hi) {
  using T = typename std::common_type<A, B, C>::type;
  T vv = (T)v, l = (T)lo, h = (T)hi;
  return vv < l ? l : (vv > h ? h : vv);
}

#ifndef min
template <typename A, typename B>
inline typename std::common_type<A, B>::type min(A a, B b) {
  using T = typename std::common_type<A, B>::type;
  return (T)a < (T)b ? (T)a : (T)b;
}
template <typename A, typename B>
inline typename std::common_type<A, B>::type max(A a, B b) {
  using T = typename std::common_type<A, B>::type;
  return (T)a > (T)b ? (T)a : (T)b;
}
#endif

/*  <cmath> puts isnan in std; the sketches call it unqualified as Arduino does. */
#ifndef isnan
using std::isnan;
using std::isinf;
#endif

/* ===========================================================================
 *  Serial — console capture, and Serial2 with an injectable RX queue and a
 *  capturable TX buffer (§7.2).
 * ======================================================================== */
namespace sil {
  extern bool             serialEcho;     // print firmware logs to stdout
  extern std::string      serialOut;      // everything the firmware printed
  extern std::deque<char> uartRx;         // bytes the firmware will read
  extern std::string      uartTx;         // bytes the firmware wrote

  inline void feedUart(const std::string &line) {
    for (char c : line) uartRx.push_back(c);
  }
  inline void resetSerial() { serialOut.clear(); uartRx.clear(); uartTx.clear(); }
}

class SilSerial {
 public:
  bool isLink;   // true = Serial2 (the UART link to ESP32 B)
  explicit SilSerial(bool link) : isLink(link) {}

  void begin(unsigned long, int = 0, int = -1, int = -1) {}
  void setTimeout(unsigned long) {}
  void flush() {}

  int  available() { return isLink ? (int)sil::uartRx.size() : 0; }
  int  read() {
    if (!isLink || sil::uartRx.empty()) return -1;
    char c = sil::uartRx.front(); sil::uartRx.pop_front(); return (unsigned char)c;
  }
  int peek() {
    if (!isLink || sil::uartRx.empty()) return -1;
    return (unsigned char)sil::uartRx.front();
  }

  void emit(const std::string &t) {
    if (isLink) sil::uartTx += t;
    else {
      sil::serialOut += t;
      if (sil::serialEcho) fputs(t.c_str(), stdout);
    }
  }

  void print(const String &v)  { emit(v.s); }
  void print(const char *v)    { emit(v ? v : ""); }
  void print(char v)           { emit(std::string(1, v)); }
  void print(int v)            { emit(String(v).s); }
  void print(unsigned int v)   { emit(String(v).s); }
  void print(long v)           { emit(String(v).s); }
  void print(unsigned long v)  { emit(String(v).s); }
  void print(float v, int d = 2) { emit(String(v, d).s); }

  void println()               { emit("\n"); }
  void println(const String &v){ emit(v.s + "\n"); }
  void println(const char *v)  { emit(std::string(v ? v : "") + "\n"); }
  void println(int v)          { emit(String(v).s + "\n"); }
  void println(long v)         { emit(String(v).s + "\n"); }
  void println(unsigned long v){ emit(String(v).s + "\n"); }
  void println(float v, int d = 2) { emit(String(v, d).s + "\n"); }

  void printf(const char *fmt, ...) {
    char buf[1024];
    va_list ap; va_start(ap, fmt);
    vsnprintf(buf, sizeof(buf), fmt, ap);
    va_end(ap);
    emit(buf);
  }
  explicit operator bool() const { return true; }
};

extern SilSerial Serial;
extern SilSerial Serial2;

/* ===========================================================================
 *  Time — configTime / getLocalTime shim.
 * ======================================================================== */
#include <ctime>
inline void configTime(long, int, const char *) {}
inline bool getLocalTime(struct tm *info, uint32_t = 5000) {
  time_t t = 1757000000;              // fixed instant, so logs are reproducible
  struct tm *g = gmtime(&t);
  if (!g || !info) return false;
  *info = *g;
  return true;
}

#endif  /* AQUAM_SIL_ARDUINO_STUB_PRELUDE_H */

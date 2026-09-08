/* ===========================================================================
 *  Aqua-M V2 — SIL harness, network stubs (WiFi / HTTPClient / Firebase)
 *
 *  Responses AND latency are scriptable (§7.2). Latency is spent on the
 *  virtual clock, so a 15 s Gemini call really does advance time by 15 s
 *  without the test waiting.
 *
 *  Every network entry point calls sil::net::guard() first. The harness sets
 *  that to a check on actuator state, which is how invariant 1 — "no network
 *  call is ever issued while a pump is running" — is enforced (§7.4.1).
 * ======================================================================== */
#ifndef AQUAM_SIL_NET_H
#define AQUAM_SIL_NET_H

#include "arduino_stub_prelude.h"

namespace sil {
namespace net {

  /*  Scripted reply for the next HTTP call. */
  struct Reply {
    int         code    = 200;    // negative values model a transport failure
    std::string body    = "";
    uint32_t    latency = 0;      // virtual ms consumed by the call
  };

  extern std::deque<Reply>  postQueue;   // consumed by HTTPClient::POST
  extern std::deque<Reply>  getQueue;    // consumed by HTTPClient::GET
  extern std::vector<std::string> requests;   // URLs called, in order
  extern std::vector<std::string> bodies;     // POST bodies, in order

  /*  Called at the top of every network operation. Throwing or recording from
   *  here is how the harness proves invariant 1. */
  extern std::function<void(const char *)> guard;

  extern int wifiStatusValue;
  extern bool firebaseReadyValue;

  inline void reset() {
    postQueue.clear(); getQueue.clear(); requests.clear(); bodies.clear();
    wifiStatusValue = 3;          // WL_CONNECTED
    firebaseReadyValue = true;
    guard = [](const char *) {};
  }
  inline void queuePost(int code, const std::string &body, uint32_t latency = 0) {
    postQueue.push_back({code, body, latency});
  }
  inline void queueGet(int code, const std::string &body, uint32_t latency = 0) {
    getQueue.push_back({code, body, latency});
  }

  inline Reply take(std::deque<Reply> &q) {
    if (q.empty()) return Reply{-1, "", 0};      // nothing scripted: fail closed
    Reply r = q.front(); q.pop_front(); return r;
  }

}  // namespace net
}  // namespace sil

/* --- WiFi ---------------------------------------------------------------- */
#define WL_CONNECTED 3
#define WIFI_STA     1

class SilWiFi {
 public:
  void mode(int) {}
  void begin(const char *, const char *) { sil::net::guard("WiFi.begin"); }
  int  status() { return sil::net::wifiStatusValue; }
  void disconnect(bool = false) {}
};
extern SilWiFi WiFi;

class WiFiClientSecure {
 public:
  void setInsecure() {}
  void setTimeout(uint32_t) {}
};

#define HTTP_CODE_OK 200
#define HTTP_CODE_TOO_MANY_REQUESTS 429

/* --- HTTPClient ---------------------------------------------------------- */
class HTTPClient {
 public:
  std::string lastUrl;
  std::string lastBody;
  int         lastCode = 0;

  bool begin(WiFiClientSecure &, const String &url) {
    sil::net::guard("http.begin");
    lastUrl = url.s;
    sil::net::requests.push_back(lastUrl);
    return true;
  }
  bool begin(const String &url) {
    sil::net::guard("http.begin");
    lastUrl = url.s;
    sil::net::requests.push_back(lastUrl);
    return true;
  }
  void addHeader(const String &, const String &) {}
  void setTimeout(uint16_t) {}
  void end() {}

  int POST(const String &body) {
    sil::net::guard("http.POST");
    lastBody = body.s;
    sil::net::bodies.push_back(lastBody);
    sil::net::Reply r = sil::net::take(sil::net::postQueue);
    sil::advance(r.latency);              // the call really does consume time
    lastCode = r.code;
    lastPayload = r.body;
    return r.code;
  }
  int GET() {
    sil::net::guard("http.GET");
    sil::net::Reply r = sil::net::take(sil::net::getQueue);
    sil::advance(r.latency);
    lastCode = r.code;
    lastPayload = r.body;
    return r.code;
  }
  String getString() { return String(lastPayload); }

 private:
  std::string lastPayload;
};

#endif  /* AQUAM_SIL_NET_H */

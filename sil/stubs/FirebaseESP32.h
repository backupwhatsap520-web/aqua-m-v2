/* ===========================================================================
 *  Aqua-M V2 — SIL harness, FirebaseESP32 stub
 *
 *  Models the Mobizt 4.x API surface the firmware actually uses. Writes are
 *  recorded so a test can assert what would have reached the database, and
 *  reads are injected so the dashboard-command path can be driven — including
 *  the hostile values §8.1 asks about (99, -1, a string where an int belongs).
 *
 *  Every call goes through sil::net::guard, so Firebase traffic is covered by
 *  invariant 1 exactly like the Gemini and weather calls.
 * ======================================================================== */
#ifndef AQUAM_SIL_FIREBASEESP32_H
#define AQUAM_SIL_FIREBASEESP32_H

#include "arduino_stub_prelude.h"
#include "sil_net.h"

namespace sil {
namespace fb {

  struct Write { std::string path; std::string value; uint32_t at_ms; };

  extern std::vector<Write>                    writes;      // every set/update
  extern std::map<std::string, std::string>    stringDb;    // injected reads
  extern std::map<std::string, int>            intDb;
  extern std::map<std::string, bool>           readFails;   // path -> fail
  extern uint32_t                              latencyMs;   // per call

  inline void reset() {
    writes.clear(); stringDb.clear(); intDb.clear(); readFails.clear();
    latencyMs = 0;
  }
  inline void putString(const std::string &p, const std::string &v) { stringDb[p] = v; }
  inline void putInt(const std::string &p, int v) { intDb[p] = v; }
  inline void failRead(const std::string &p) { readFails[p] = true; }

  inline bool wrote(const std::string &path) {
    for (auto &w : writes) if (w.path == path) return true;
    return false;
  }
  inline std::string lastWrite(const std::string &path) {
    for (auto it = writes.rbegin(); it != writes.rend(); ++it)
      if (it->path == path) return it->value;
    return "";
  }

}  // namespace fb
}  // namespace sil

/* --- FirebaseJson -------------------------------------------------------- */
class FirebaseJson {
 public:
  std::string blob;

  void add(const String &k, const String &v) { set(k, v); }

  void set(const String &k, const String &v) { append(k.s, v.s); }
  void set(const String &k, const char *v)   { append(k.s, v ? v : ""); }
  void set(const String &k, int v)           { append(k.s, String(v).s); }
  void set(const String &k, long v)          { append(k.s, String(v).s); }
  void set(const String &k, unsigned long v) { append(k.s, String(v).s); }
  void set(const String &k, float v)         { append(k.s, String(v, 2).s); }
  void set(const String &k, double v)        { append(k.s, String(v, 2).s); }
  void set(const String &k, bool v)          { append(k.s, v ? "true" : "false"); }

  void clear() { blob.clear(); }
  void toString(String &out, bool = false) const { out = String(blob); }

 private:
  void append(const std::string &k, const std::string &v) {
    if (!blob.empty()) blob += ",";
    blob += "\"" + k + "\":" + v;
  }
};

/* --- FirebaseData -------------------------------------------------------- */
class FirebaseData {
 public:
  std::string _string;
  int         _int = 0;

  void setBSSLBufferSize(int, int) {}
  void setResponseSize(int) {}
  String stringData() { return String(_string); }
  int    intData()    { return _int; }
  String errorReason(){ return String("sil: scripted failure"); }
  bool   httpConnected() { return true; }
};

/* --- config / auth ------------------------------------------------------- */
struct FirebaseTokens { String legacy_token; };
struct FirebaseSigner { FirebaseTokens tokens; };
class FirebaseConfig {
 public:
  String         database_url;
  FirebaseSigner signer;
};
class FirebaseAuth { public: int _unused = 0; };

/* --- the Firebase singleton ---------------------------------------------- */
class SilFirebase {
 public:
  void begin(FirebaseConfig *, FirebaseAuth *) { sil::net::guard("Firebase.begin"); }
  void reconnectWiFi(bool) {}
  bool ready() { return sil::net::firebaseReadyValue; }

  bool updateNode(FirebaseData &, const String &path, FirebaseJson &j) {
    sil::net::guard("Firebase.updateNode");
    sil::advance(sil::fb::latencyMs);
    sil::fb::writes.push_back({path.s, "{" + j.blob + "}", sil::clock_ms});
    return true;
  }
  bool setString(FirebaseData &, const String &path, const String &v) {
    sil::net::guard("Firebase.setString");
    sil::advance(sil::fb::latencyMs);
    sil::fb::writes.push_back({path.s, v.s, sil::clock_ms});
    sil::fb::stringDb[path.s] = v.s;
    return true;
  }
  bool setInt(FirebaseData &, const String &path, int v) {
    sil::net::guard("Firebase.setInt");
    sil::advance(sil::fb::latencyMs);
    sil::fb::writes.push_back({path.s, String(v).s, sil::clock_ms});
    sil::fb::intDb[path.s] = v;
    return true;
  }
  bool getString(FirebaseData &d, const String &path) {
    sil::net::guard("Firebase.getString");
    sil::advance(sil::fb::latencyMs);
    if (sil::fb::readFails.count(path.s)) return false;
    auto it = sil::fb::stringDb.find(path.s);
    if (it == sil::fb::stringDb.end()) return false;
    d._string = it->second;
    return true;
  }
  bool getInt(FirebaseData &d, const String &path, int *out) {
    sil::net::guard("Firebase.getInt");
    sil::advance(sil::fb::latencyMs);
    if (sil::fb::readFails.count(path.s)) return false;
    auto it = sil::fb::intDb.find(path.s);
    if (it == sil::fb::intDb.end()) return false;
    d._int = it->second;
    if (out) *out = it->second;
    return true;
  }
};
extern SilFirebase Firebase;

#endif  /* AQUAM_SIL_FIREBASEESP32_H */

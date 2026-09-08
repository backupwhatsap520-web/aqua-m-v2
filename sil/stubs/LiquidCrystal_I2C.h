/* LCD stub — captures the two 16-character lines so a test can assert what
 * the operator would actually see. */
#ifndef AQUAM_SIL_LCD_H
#define AQUAM_SIL_LCD_H
#include "arduino_stub_prelude.h"

namespace sil {
  extern std::string lcdLine[2];
  extern int         lcdRow, lcdCol;
}

class LiquidCrystal_I2C {
 public:
  LiquidCrystal_I2C(uint8_t, uint8_t, uint8_t) {}
  void init() {}
  void backlight() {}
  void noBacklight() {}
  void clear() { sil::lcdLine[0].clear(); sil::lcdLine[1].clear(); }
  void setCursor(int col, int row) {
    sil::lcdCol = col;
    sil::lcdRow = (row >= 0 && row < 2) ? row : 0;
  }
  void print(const char *t) {
    std::string &l = sil::lcdLine[sil::lcdRow];
    if ((int)l.size() < sil::lcdCol) l.resize(sil::lcdCol, ' ');
    for (const char *p = t; *p; ++p) {
      if (sil::lcdCol < (int)l.size()) l[sil::lcdCol] = *p;
      else l.push_back(*p);
      sil::lcdCol++;
    }
  }
  void print(char c) { char b[2] = {c, 0}; print(b); }
  void print(const String &s) { print(s.c_str()); }
  void print(int v) { print(String(v).c_str()); }
};
#endif

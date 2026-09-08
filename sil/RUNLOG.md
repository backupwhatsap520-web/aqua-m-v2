# Aqua-M V2 — verification run log

Append-only. One block per iteration, including hypotheses that turned out
wrong. Never rewrite earlier entries.

Branch: `verify/build-pass`

---

## Iteration 0 — 2026-09-08 14:37

**Phase:** 0 (setup)

**Environment as found**

| Item | State |
|------|-------|
| Host | Windows 11 Pro 26200, git bash + PowerShell |
| arduino-cli | 1.2.0, bundled inside Arduino IDE 2 at `%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe` |
| Cores installed | `esp32:esp32` 3.3.11, `arduino:esp32` 2.0.18-arduino.5, `arduino:avr` 1.8.6 |
| Node | v24.19.0, npm 11.17.0 |
| Website | **absent** — the `website/` tree the brief describes does not exist in this repo |

The brief's §3.1 install script was not needed: arduino-cli ships inside the
Arduino IDE already on this machine, and the current `esp32:esp32` core is
already present. Core `esp32:esp32@2.0.17` is **not** installed yet and is
required by the build matrix.

Note `arduino:esp32` 2.0.18-arduino.5 is Arduino's own ESP32 core, a different
package from Espressif's `esp32:esp32`. It is not a substitute for 2.0.17 in the
matrix.

**Change:** `.gitignore` rewritten — added `*.local` and `sil/out/` as §2.5
requires, and converted its comments to English to match the repo convention
stated in §11.

**Result:** branch `verify/build-pass` created off `main`. No firmware touched.

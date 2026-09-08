#!/usr/bin/env bash
# Aqua-M V2 — build and run the SIL harness (brief §7.7: one command).
set -uo pipefail

GXX="${GXX:-$LOCALAPPDATA/Microsoft/WinGet/Packages/BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe/mingw64/bin/g++.exe}"
AJ="${AJ:-$HOME/.aquam-build/user/libraries/ArduinoJson/src}"
HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
mkdir -p "$OUT"

FLAGS=(-std=c++17 -x c++ -O1
       -DARDUINOJSON_ENABLE_ARDUINO_STRING=1
       -DARDUINOJSON_ENABLE_ARDUINO_STREAM=0
       -DARDUINOJSON_ENABLE_ARDUINO_PRINT=0
       -DARDUINOJSON_ENABLE_PROGMEM=0
       -I "$HERE/stubs" -I "$AJ")

rc=0
for h in a b; do
  src="$HERE/harness_$h.cpp"
  [ -f "$src" ] || continue
  echo "--- building harness_$h ---"
  if ! "$GXX" "${FLAGS[@]}" "$src" "$HERE/stubs/sil_globals.cpp" -o "$OUT/harness_$h.exe" 2>"$OUT/build_$h.log"; then
    echo "BUILD FAILED — see $OUT/build_$h.log"
    grep -m5 "error:" "$OUT/build_$h.log"
    rc=1
    continue
  fi
  "$OUT/harness_$h.exe" || rc=1
done
exit $rc

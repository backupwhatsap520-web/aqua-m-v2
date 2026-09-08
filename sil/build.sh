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

# run <name> <source> [extra -D flags...]
run() {
  local name="$1" src="$2"; shift 2
  [ -f "$src" ] || return 0
  echo "--- building $name ---"
  if ! "$GXX" "${FLAGS[@]}" "$@" "$src" "$HERE/stubs/sil_globals.cpp" \
        -o "$OUT/$name.exe" 2>"$OUT/build_$name.log"; then
    echo "BUILD FAILED — see $OUT/build_$name.log"
    grep -m5 "error:" "$OUT/build_$name.log"
    rc=1
    return 0
  fi
  "$OUT/$name.exe" || rc=1
}

run harness_a "$HERE/harness_a.cpp"

#  §7.5 invariant 14 asks for both TRACK_LINE_WIDE branches to be exercised,
#  not merely compiled, so ESP32 B runs twice. The switches are #ifndef-guarded,
#  which is what lets -D reach them.
run harness_b       "$HERE/harness_b.cpp"
run harness_b_wide0 "$HERE/harness_b.cpp" -DTRACK_LINE_WIDE=0
run harness_b_rev1  "$HERE/harness_b.cpp" -DREVERSE_STEER_INVERT=1

exit $rc

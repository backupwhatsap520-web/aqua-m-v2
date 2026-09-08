#!/usr/bin/env bash
# Aqua-M V2 — firmware build matrix (brief §5.1)
#
# Builds every sketch / core / ArduinoJson / switch combination the brief
# requires and prints flash and RAM per combination.
#
# Usage:  bash tools/build_matrix.sh [-A|-B|-AB]     (default: -AB)
#
# Why two data directories:
#   arduino-cli keeps one version of a core per data directory, so building
#   against both esp32:esp32 2.0.17 and 3.3.11 needs two of them. The 3.x one is
#   the Arduino IDE's own installation; the 2.0.17 one is a sandbox created for
#   this verification so the IDE is left alone. Same idea for ArduinoJson 6 vs 7,
#   which live in two separate user (sketchbook) directories.
#
# Environment overrides:
#   ARDUINO_CLI     path to arduino-cli
#   DATA_3X         data dir holding esp32:esp32 3.x   (default: Arduino IDE's)
#   DATA_2X         data dir holding esp32:esp32 2.0.17
#   USER_AJ7        sketchbook dir holding ArduinoJson 7.x
#   USER_AJ6        sketchbook dir holding ArduinoJson 6.x
#   OUT_DIR         where logs land (default: sil/out/build)

set -uo pipefail

ARDUINO_CLI="${ARDUINO_CLI:-$LOCALAPPDATA/Programs/Arduino IDE/resources/app/lib/backend/resources/arduino-cli.exe}"
DATA_3X="${DATA_3X:-$LOCALAPPDATA/Arduino15}"
DATA_2X="${DATA_2X:-$HOME/.aquam-build/data}"
USER_AJ7="${USER_AJ7:-$HOME/.aquam-build/user}"
USER_AJ6="${USER_AJ6:-$HOME/.aquam-build/user-aj6}"
OUT_DIR="${OUT_DIR:-sil/out/build}"

mkdir -p "$OUT_DIR"

FQBN="esp32:esp32:esp32:PartitionScheme=huge_app"

pass=0
fail=0
results=()

# build <label> <sketch-dir> <core: 2|3> <json: aj6|aj7|na> [extra -D flags]
build() {
  local label="$1" sketch="$2" core="$3" json="$4" flags="${5:-}"
  local log="$OUT_DIR/${label}.log"

  case "$core" in
    2) export ARDUINO_DIRECTORIES_DATA="$DATA_2X" ;;
    3) export ARDUINO_DIRECTORIES_DATA="$DATA_3X" ;;
  esac
  case "$json" in
    aj6) export ARDUINO_DIRECTORIES_USER="$USER_AJ6" ;;
    *)   export ARDUINO_DIRECTORIES_USER="$USER_AJ7" ;;
  esac

  local args=(compile --fqbn "$FQBN" --warnings all --json)
  [ -n "$flags" ] && args+=(--build-property "compiler.cpp.extra_flags=$flags")
  args+=("$sketch")

  printf '%-34s ' "$label"
  if "$ARDUINO_CLI" "${args[@]}" >"$log" 2>&1; then
    # Sizes live in compiler_out and warnings in compiler_err, each embedded in
    # the JSON as a single escaped line — so count matches with -o, not lines.
    local flash ram warns skwarns
    flash=$(grep -o 'Sketch uses [0-9]*' "$log" | head -1 | grep -o '[0-9]*')
    ram=$(grep -o 'Global variables use [0-9]*' "$log" | head -1 | grep -o '[0-9]*')
    warns=$(grep -o 'warning:' "$log" | wc -l | tr -d ' ')
    skwarns=$(grep -o 'AquaM_ESP32_[AB]\.ino:[0-9]*:[0-9]*: warning:' "$log" | wc -l | tr -d ' ')
    echo "PASS  flash=${flash:-?}  ram=${ram:-?}  warn=$warns (sketch $skwarns)"
    results+=("$label|PASS|${flash:-?}|${ram:-?}|$warns|$skwarns")
    pass=$((pass + 1))
  else
    local firsterr
    firsterr=$(grep -o 'error: [^\\]*' "$log" | head -1 | cut -c1-70)
    echo "FAIL  ${firsterr:-see $log}"
    results+=("$label|FAIL|-|-|-|-")
    fail=$((fail + 1))
  fi
}

A=firmware/AquaM_ESP32_A
B=firmware/AquaM_ESP32_B
which="${1:--AB}"

if [[ "$which" == *A* ]]; then
  build "A_core2_aj6"          "$A" 2 aj6 ""
  build "A_core2_aj7"          "$A" 2 aj7 ""
  build "A_core3_aj6"          "$A" 3 aj6 ""
  build "A_core3_aj7"          "$A" 3 aj7 ""
  build "A_core3_aj7_cooldown" "$A" 3 aj7 "-DCOOLDOWN_PER_POT=1"
fi

if [[ "$which" == *B* ]]; then
  build "B_core2"              "$B" 2 na ""
  build "B_core3"              "$B" 3 na ""
  build "B_core3_cp_inner"     "$B" 3 na "-DCHECKPOINT_USES_INNER_SENSORS=1"
  build "B_core3_track_narrow" "$B" 3 na "-DTRACK_LINE_WIDE=0"
  build "B_core3_rev_invert"   "$B" 3 na "-DREVERSE_STEER_INVERT=1"
  build "B_core3_single_pwm"   "$B" 3 na "-DMOTOR_DRIVER_DUAL_PWM=0"
fi

echo
echo "| Combination | Result | Flash (B) | RAM (B) | Warnings | of which sketch |"
echo "|-------------|--------|-----------|---------|----------|-----------------|"
for r in "${results[@]}"; do
  IFS='|' read -r l s f m w sw <<<"$r"
  echo "| \`$l\` | $s | $f | $m | $w | $sw |"
done
echo
echo "passed: $pass   failed: $fail"
[ "$fail" -eq 0 ]

#!/bin/sh
# Per-gate timing wrapper — TEMPORARY instrumentation (charly-fx4 review).
#
# Mirrors tambor's tools/gate-timing.sh (tambor-j44): runs a gate command,
# propagates its exit code, and appends one CSV row per invocation to
# $GATE_TIMING_LOG (default: ./.gate-timing.log):
#
#     ts,gate,exit,duration_ms
#
# Purpose: measure wanna's pre-push cost distribution before/after the
# ah range-selection fix (charly-vibes/espectacular GH#42). Once ah ships
# --base/--head and wanna's lefthook uses it, this wrapper and its wiring
# are scheduled for removal — see bd ticket in this repo
# ("Remove gate-timing instrumentation once ah check --base/--head lands").
# The log is gitignored.

set -u

if [ $# -lt 2 ]; then
    echo "usage: gate-timing.sh <gate-name> <cmd...>" >&2
    exit 64
fi

gate="$1"
shift
log="${GATE_TIMING_LOG:-.gate-timing.log}"

start=$(date +%s%3N)
"$@"
code=$?
end=$(date +%s%3N)

if [ ! -f "$log" ]; then
    printf 'ts,gate,exit,duration_ms\n' >"$log"
fi
printf '%s,%s,%s,%s\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$gate" "$code" "$((end - start))" >>"$log"

exit "$code"
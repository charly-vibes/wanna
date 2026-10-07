#!/usr/bin/env bash
# ah-check — gate: espectacular structural + execution verification passes.
# Corr verifies: ah check (coverage, 0 findings) AND contract tests (ah check --run-tests).
set -euo pipefail
if ! ah check >/dev/null 2>&1; then
    echo "ah check failed — structural findings:" >&2
    ah check 2>&1 | head -20 >&2
    exit 1
fi
if ! ah check --run-tests >/dev/null 2>&1; then
    echo "ah check --run-tests failed — contract test failures:" >&2
    ah check --run-tests 2>&1 | tail -20 >&2
    exit 1
fi

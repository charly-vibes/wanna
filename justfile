# Local/CI parity entrypoint (ddl standard — .github/workflows/ci.yml runs
# exactly this; if CI fails, run `just ci` locally to reproduce).
#
# Mirrors the lefthook gates (lefthook.yml): tsc-gate, eslint-gate, ah check,
# specodelic-gate (spk lint), pretender pre-push scope, plus the vitest suite.
# Not in CI parity (they stay lefthook-local gates):
#   - `testaruda select` — interactive selection; pre-push only
#   - `ah check --run-tests` — exceeds a 10-minute budget even locally

default:
    @just --list

ci:
    npx tsc --noEmit -p tsconfig.json
    npx eslint src
    npm test
    ah check
    spk lint openspec
    pretender check src tests tools --mode gate

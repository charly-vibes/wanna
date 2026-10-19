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
    # ah binary floor (wanna-8kq): range selection (--base, GH#42) needs
    # espectacular >= 0.12.0 — the ci.yml smoke pin (0.9.3) is CI-install
    # ONLY; never run its cargo install line locally, it clobbers the real ah
    sh -c 'ah --version | grep -q "0\.12\." || { echo "ah >= 0.12.0 required locally (cargo install --locked espectacular@0.12.0)"; exit 1; }'
    npx tsc --noEmit -p tsconfig.json
    npx eslint src
    npm test
    ah check
    spk lint openspec
    openspec validate --all --strict
    pretender check src tests tools --mode gate

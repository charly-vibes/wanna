# Subagent brief: wanna-3iw RECOVERY — implement capability-contract (bounded, do NOT over-explore)

You are a pi subagent in repo `/var/home/sasha/para/areas/dev/gh/charly/wanna`.
Ticket `wanna-3iw` is already claimed. A previous subagent burned an entire
hour on orientation and wrote NOTHING — the tree is clean. You have a BUDGET:
finish within ~40 minutes. Efficiency rule: read ONLY the four files listed
below plus the spec, then start writing. Do NOT read every exemplar file; do
NOT explore the repo.

## Read exactly these, then start (≤10 minutes)
1. `openspec/specs/capability-contract/spec.md` — the full spec (transitions, properties).
2. `src/capability-contract/` neighbors are NOT written; use `src/continuity-contract/` as the freshest exemplar (machine.ts + invariants.ts + types.ts pattern) — skim only.
3. `tests/continuity-contract/transitions.test.ts` + one properties file — skim only.
4. `.espectacular/capability-contract/p-*.toml` — list names; you'll bind these.

## Build (TDD, exact same flow as 53d/agv/cr9)
1. RED: `tests/capability-contract/transitions.test.ts` (one test per ## Model
   transition, exact reason strings) + `tests/capability-contract/properties-*.test.ts`
   (one test per p-*/property, named with the EXACT spec description text).
2. GREEN: `src/capability-contract/` (machine.ts, types.ts, invariants.ts,
   index.ts — split as needed). Purpose/Responsibilities/Rationale header per file.
3. REFACTOR: function_lines ≤40, cyclomatic ≤10 — split proactively.
4. Bind every `p-*` TOML in `.espectacular/capability-contract/`: replace ONLY
   `[[tests.shell]]` command with
   `npx vitest run tests/capability-contract/properties*.test.ts -t '<exact
   description>'` (timeout_seconds 120); keep all other fields byte-identical.
   Leave the `violating-*` conformance-gate TOML untouched.
5. Commit in ≤3 conventional commits `(wanna-3iw)`; stage ONLY your files;
   never bare `git add`.

## Gates (all must pass; then stop and report)
- `npx vitest run tests/capability-contract/` green
- `ah check --run-tests` exit 0, 0 findings (transient "error -122 write"
  flakes → rerun)
- `spk lint openspec` clean; `pretender check src/capability-contract
  tests/capability-contract` clean; `npx eslint src/capability-contract
  tests/capability-contract` clean

## Rules
NO push, NO bd, NO wai close. No new deps. Scope: only the four dirs above.

## Report format
## Report — **Commits** (hash+message), **Gates** (each → result), **Tests**
(n transitions + n properties), **Deviations**, **Next**.
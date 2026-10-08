# Subagent brief: wanna-pps — fix repo-wide tsc drift + add tsc pre-commit gate

You are a pi subagent in repo `/var/home/sasha/para/areas/dev/gh/charly/wanna`.
Ticket `wanna-pps` is already claimed. You own this end-to-end including
commits. The orchestrator verifies with real gates.

## Problem
`npx tsc --noEmit` reports ~285 repo-wide errors (mostly TS2532 "Object is
possibly 'undefined'" from machine-state accessors, plus `.reason` narrowing)
across many implemented modules — e.g. src/session-state/machine.ts (12),
src/interaction-policy/machine.ts (11), src/recovery-contract/machine.ts (5),
src/interaction-primitives/invariants.ts (5), plus matching test files. All
runtime gates pass; this is pure type-level drift accumulated across
subagent-implemented modules.

## Job
1. Run `npx tsc --noEmit` and fix every error WITHOUT changing runtime
   behavior: prefer precise typing (non-null assertions ONLY at genuinely
   invariant-guarded spots with a comment naming the invariant; otherwise
   narrow with guards) over `any` casts or `@ts-expect-error` suppression.
   If a runtime accessor can genuinely return undefined where the code assumes
   it cannot, add a narrow guard that throws/returns the layer's exact failure
   reason — do NOT silently coerce.
2. Add `npx tsc --noEmit` as a pre-commit gate in `lefthook.yml` (follow the
   existing gate shim pattern in `.beads/hooks`/lefthook.yml; name it
   `tsc-gate`, make it fast by scoping to the project tsconfig).
3. Commit in logical batches per module area, conventional style `(wanna-pps)`,
   staging ONLY your files. Never bare `git add`; never commit `.whisper/`/`.wai/`.

## Gates (all must pass before your report)
- `npx tsc --noEmit` — ZERO errors repo-wide
- `npx vitest run` — full suite green, no regressions
- `ah check --run-tests` — exit 0, 0 findings (transient "-122 write" flakes → rerun)
- `spk lint openspec` — clean
- `pretender check src tests` — clean
- `npx eslint src tests` — clean

## Rules
- Do NOT edit `openspec/`, `.espectacular/` (type fixes only; no spec/contract changes).
- Do NOT change any observable runtime behavior or failure-reason strings.
- No new dependencies. NO push, NO bd, NO wai close.

## Report format
## Report — **Commits**, **Gates** (each → result), **Fixes** (count by error
type + any behavior-adjacent guards added), **Deviations**, **Next**.
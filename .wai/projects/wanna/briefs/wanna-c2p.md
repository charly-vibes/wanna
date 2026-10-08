# Subagent brief: wanna-c2p — Escalate conformance tests to fast-check property-based testing

You are a pi subagent in repo `/var/home/sasha/para/areas/dev/gh/charly/wanna`
(TS/vitest monorepo of the `wanna` specodelic corpus). An orchestrator has
claimed ticket `wanna-c2p` and is hands-off: you own the implementation
end-to-end, including commits. The orchestrator verifies with real gates —
never claim work the diff doesn't contain.

## Orientation (do this first)

- Read the ticket intent: real PBT for the corpus — replace placeholder
  generator column values (`any::<String>()`) with fast-check generators per
  property; escalate generator-friendly concrete tests in `tests/catalog` and
  `tests/engine`; fix the non-recursive `readdirSync` walk in
  `properties-static.test.ts`.
- Read `AGENTS.md` (shell-safety), then the prior notes on the "REAL PBT
  path": fast-check driven by the corpus generator column, gated via
  `spk compile`/`spk verify` when proptest blocks exist.
- Implemented specs with src+tests: interaction-need, interaction-engine,
  component-catalog, contribution-primitives, event-envelope, session-state,
  interaction-catalog, interaction-contract, process-model,
  interaction-primitives, interaction-patterns.

## What to build

1. Add `fast-check` devDependency (no other new deps).
2. Fix `properties-static.test.ts` FIRST (independent, commits separately):
   recursive readdirSync walk so engine subdirs are covered.
3. Per implemented spec, pick the generator-friendly properties (determinism,
   ordering, staleness, bounds, dedup are good; "version is pinned"-style
   identity properties are NOT). Write fast-check properties (≥100 run cases
   each) in `tests/<spec>/properties-pbt.test.ts` wrapping the existing
   machine API. Aim: at least one fast-check property per implemented spec.
4. Generator column: for each property you escalated, set the corpus-side
   generator value in `openspec/specs/<spec>/spec.md` (replace
   `any::<String>()` placeholders with the real generator expression, e.g.
   `fc.array(fc.string())`). This is corpus-editing — keep every other cell
   byte-identical. Re-run `spk lint openspec` after each file.
5. `spk compile <specs you touched>` — emit proptest artifacts so the verify
   path can gate on outcomes (artifacts under specodelic/ are gitignored; do
   not commit generated artifacts). If `spk verify` runs locally, run it and
   report outcomes; do not wire new lefthook steps.
6. Contract TOMLs: for each fast-check property, the existing p-* TOML should
   bind to the vitest test that wraps the fast-check run — update ONLY the
   `[[tests.shell]]` command if the test moved/renamed. Do not weaken
   descriptions or touch other fields. Non-generator-friendly properties keep
   their concrete tests.

## Hard scope guard

- Allowed: `package.json` (fast-check dep only), `tests/**` (pbt files +
  properties-static fix + catalog/engine escalations),
  `openspec/specs/*/spec.md` generator column cells only,
  `.espectacular/*/` TOML shell commands only where a test moved.
- Never edit: `src/**` beyond what tests require (NONE expected — write tests
  against existing public APIs; if an API is genuinely test-inaccessible,
  report it instead of changing src), `.wai/**`, lefthook config,
  `.espectacular` TOMLs for unimplemented specs.

## Repo facts (boilerplate)

- **Commit hygiene**: stage ONLY files you authored (`git add <paths>`,
  never bare `git add`); conventional messages with the bead `(wanna-c2p)`.
  Do NOT commit `.whisper/`, `.wai/`, or generated `specodelic/` artifacts.
- **Do NOT push** — the orchestrator verifies and pushes.
- **No `bd` commands, no `wai close`** — orchestrator owns those.
- **Non-interactive shells**: use `-f`/`-rf`/`-y` flags.

## Gates you MUST run and pass before reporting done

- `npx vitest run` — full suite green, no regressions (baseline ~153 tests)
- `ah check --run-tests` — exit 0, 0 findings
- `spk lint openspec` — clean (3 pre-existing observability advisories are noise)
- `pretender check src tests` — clean (function_lines ≤40, cyclomatic ≤10)
- `npx eslint src tests` — clean (ignore pre-existing `CANDIDATE_ORDER` error
  in tests/engine/properties-core.test.ts — actually: FIX it if trivial, it is
  an unused import in your area)

## Report format (end with this)

## Report
**Commits** — hash + message + one line each
**Gates run** — each gate → result
**PBT**: <n> fast-check properties across <n> specs; case counts; generator column cells updated; spk compile/verify outcomes
**Deviations** (or "none")
**Next** — next action for orchestrator or "ticket complete"
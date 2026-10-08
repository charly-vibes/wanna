# Subagent brief: wanna-53d RECOVERY — finish evidence-provenance

You are a pi subagent in repo `/var/home/sasha/para/areas/dev/gh/charly/wanna`.
A previous subagent (session `subagent:wanna-53d:impl`, killed at a 1h timeout)
left UNCOMMITTED work: `src/evidence-provenance/` (types, invariants, machine,
index) and `tests/evidence-provenance/` (fixtures, transitions,
properties-classification, properties-conformance, properties-pbt). 18/19
tests pass. Contracts NOT yet bound (0 TOMLs in
`.espectacular/evidence-provenance/` carry vitest shells). Nothing committed.

## Your job (finish, don't restart)
1. Read the existing src+tests first, then `openspec/specs/evidence-provenance/spec.md`.
2. Fix the ONE failing test:
   `tests/evidence-provenance/properties-pbt.test.ts > a claim does not become normative merely because it appears in a research report; normative strength is explicitly assigned and traceable`
   — fix the TEST (or the impl if genuinely wrong) without weakening any
   assertion; exact reason strings only, no loose regexes.
3. Upgrade the p-* / invariant TOMLs in `.espectacular/evidence-provenance/`
   from spk lint shells to vitest bindings, modeled on
   `.espectacular/interaction-need/p-need-schema-valid.toml`: keep ALL header
   fields unchanged; replace only `[[tests.shell]]` command with
   `npx vitest run tests/evidence-provenance/properties*.test.ts -t '<exact
   property description>'` (timeout_seconds 120). Leave
   `violating-evidence-and-provenance-invariant-is-rejected.toml` untouched.
4. Commit in ≤3 conventional commits mentioning (wanna-53d); stage ONLY your
   files. Do NOT commit `.whisper/` or `.wai/`.

## Gates (all must pass before your report)
- `npx vitest run tests/evidence-provenance/` — all green
- `ah check --run-tests` — exit 0, 0 findings (if you hit transient
  "Unknown system error -122, write" errors, rerun — they are flaky)
- `spk lint openspec` — clean
- `pretender check src/evidence-provenance tests/evidence-provenance` — clean
  (function_lines ≤40, cyclomatic ≤10 — split proactively)
- `npx eslint src/evidence-provenance tests/evidence-provenance` — clean

## Rules
- Do NOT push, run `bd` commands, or `wai close` — orchestrator owns those.
- Do NOT touch other specs' contracts or src outside evidence-provenance.
- No new dependencies.

## Report format
## Report
**Commits** — hash + message + one line
**Gates run** — each → result
**Tests** — <n> transitions + <n> properties
**Deviations** (or "none")
**Next** — orchestrator action or "ticket complete"
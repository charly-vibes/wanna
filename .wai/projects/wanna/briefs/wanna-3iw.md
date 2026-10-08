# Subagent brief: wanna-3iw — Implement capability-contract

You are a pi subagent in repo `/var/home/sasha/para/areas/dev/gh/charly/wanna`
(TS/vitest monorepo of the `wanna` specodelic corpus). An orchestrator has
claimed ticket `wanna-3iw` and is hands-off: you own the implementation
end-to-end, including commits. The orchestrator verifies with real gates —
never claim work the diff doesn't contain.

## Orientation (do this first)

- Read, in order:
  1. `openspec/specs/capability-contract/spec.md` — the full spec (intent,
     ## Model states + transitions, ## Requirements, p-* properties, constraints).
  2. `src/interaction-need/` + `tests/interaction-need/` +
     `.espectacular/interaction-need/` — the pilot exemplar; wanna-8zj ran the
     exact flow you must follow.
  3. Repo-root `AGENTS.md` (shell-safety rules).
- `wai search "capability-contract"` — check accumulated patterns.

## What to build (TDD, strict red→green→refactor)

1. RED: failing tests first in `tests/capability-contract/`:
   - `transitions.test.ts` — one test per ## Model transition, asserting PRECISE
     failure reasons (masked-violation lesson from roles_allowlisted: loose
     reason regexes let real bypasses through; assert exact reason strings).
   - `properties-*.test.ts` — one test per p-* property, named with the EXACT
     property description text from the spec (contracts bind via
     `vitest -t '<description>'`).
2. GREEN: implement `src/capability-contract/` (`machine.ts`, `types.ts`,
   `index.ts`, split further if needed) until green.
3. REFACTOR: pretender enforces function_lines ≤40, cyclomatic ≤10 — split
   proactively (the pilot needed 2 splits; don't wait for the gate).
4. Contracts: upgrade every TOML in `.espectacular/capability-contract/`
   from spk lint shells to real vitest bindings, modeled exactly on
   `.espectacular/interaction-need/p-need-schema-valid.toml`: keep
   `archetype/authored_with/derived_from/description/falsifiability_class/id/
   status/superseded_by` UNCHANGED; replace only the `[[tests.shell]]` command
   with `npx vitest run tests/capability-contract/properties*.test.ts -t
   '<exact property description>'` (timeout_seconds 120). One TOML per p-*.
   Do NOT weaken descriptions, delete TOMLs, or touch any other spec's contracts.

## Hard scope guard

- Allowed: `src/capability-contract/`, `tests/capability-contract/`,
  `openspec/specs/capability-contract/`, `.espectacular/capability-contract/`
- Never edit: any other spec/contract, `tests/engine/`, `src/engine/`,
  `src/catalog/`, `.wai/**`, `pretender.toml`, lefthook config.

## Repo facts (boilerplate)

- **Commit hygiene**: before ANY `git commit`, run `git status --short`; stage
  ONLY files you authored (`git add <paths>`, never bare `git add`); commit
  message attributes only what the diff contains (conventional style, mention
  the bead: `(wanna-3iw)`). Do NOT commit `.whisper/` or `.wai/` churn.
- **Do NOT push** — the orchestrator verifies and pushes.
- **Do NOT run any `bd` commands** — the ticket is already claimed; the
  orchestrator owns close.
- **Do NOT run `wai close`**.
- **New source files** need Purpose/Responsibilities/Rationale headers.
- **No new dependencies**; vitest + TypeScript only, pilot-style typing (no `any`).
- **Non-interactive shells**: use `-f`/`-rf`/`-y` flags; commands may be aliased
  with `-i` and hang on prompts.

## Gates you MUST run and pass before reporting done

- `npx vitest run tests/capability-contract/` — green
- `ah check --run-tests` — exit 0, 0 findings (corpus-wide, ~370 tests)
- `spk lint openspec` — clean
- `pretender check src/capability-contract tests/capability-contract` — clean
- `npx eslint src/capability-contract tests/capability-contract` — clean

Known noise to IGNORE (not yours): eslint `CANDIDATE_ORDER` unused-var in
`tests/engine/properties-core.test.ts`; `.whisper/` + `.wai/` dirty files.

## Report format (end with this)

## Report
**Commits**
- `<hash>` <message> — one line

**Gates run**
- each gate → result

**Tests**: <n> transitions + <n> properties

**Deviations** (or "none")

**Next**
- exact next action for the orchestrator, or "ticket complete"
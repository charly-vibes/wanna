---
tags: [pipeline-run:corpus-gates-2026-10-07-spec-corpus-gates-batch-wanna-agl-fhl-bvp-u08-9nc, pipeline-step:author-scenarios]
---

# Tracer Bullet: Component-Catalog End-to-End Slice

## Purpose

Validate the full toolchain — spec → contract → real implementation → real test
→ gates — with the thinnest possible slice before scaling to all 30 specs.
The system currently validates structure only: every contract test is a
placeholder `spk lint` shell command and testaruda tracks **0 tests**. The
tracer bullet proves the chain carries *behavioral* weight.

## Slice choice: `component-catalog`

- Smallest spec (106 lines): 4 states, 4 transitions, 7 invariant constraints,
  7 unit properties — no async, no I/O, pure domain logic.
- Property predicates already declare `TypeScript conformance test` — the
  implementation language is settled by the corpus itself.
- Independent of interaction-engine; a clean first cut that doesn't drag the
  whole core in.

## The chain under test

```
openspec/specs/component-catalog/spec.md
  └─ .espectacular/component-catalog/*.toml   (contracts)
       └─ tests/catalog/*.test.ts             (real vitest tests)
            └─ src/catalog/*.ts               (real implementation)
                 └─ lefthook pre-push: ah check --run-tests + testaruda select
                      └─ .testaruda metrics: tests tracked > 0
```

## Phases (each maps to a red→green→refactor cycle)

### 1. TS runtime scaffold (red→green: trivial test fails without runner, passes with)
- package.json + tsconfig + vitest; testaruda typescript adapter discovery
- **Validation**: `testaruda select` discovers and runs one trivial test;
  metrics show 1 tracked test.

### 2. Catalog core, TDD from spec properties (red→green→refactor)
- **Red first**: write failing tests for the 7 properties
  (catalog_version_pinned, roles_allowlisted, host_capabilities_declared,
  schema_mapping_explicit, fallback_graph_acyclic, catalog_changes_reviewed,
  limits_consistent) straight from the spec's predicate text.
- **Green**: implement the state machine — states
  `draft/validated/published/deprecated`, transitions `validate_catalog`,
  `reject_catalog`, `publish_catalog`, `deprecate_catalog` with their guards,
  plus the invariants at the trust boundary.
- **Refactor** in a separate commit.

### 3. Contract upgrade pilot (the wanna-u08 pattern, proven for one spec)
- Replace `tests.shell = spk lint` placeholders in
  `.espectacular/component-catalog/*.toml` with real vitest invocations
  exercising the implementation.
- Keep `ah check` structural validation green throughout.

### 4. Gate falsifiability check (the actual "system works" proof)
- Mutate the implementation to violate one invariant → pre-push gate must
  reject with a finding naming the violated row.
- Restore → gate passes; testaruda metrics show tracked tests > 0.
- Record evidence: `wai add research "TRACER: ..."`.

## Definition of done

1. All component-catalog properties verified by real tests, not lint shells.
2. `ah check --run-tests` green; testaruda tracked > 0; runs ingested > 0.
3. Deliberate violation rejected by the gate with a named finding.
4. Pattern documented so per-spec replication (interaction-engine next) is mechanical.

## Then build on top

- Replicate the pattern spec-by-spec, `interaction-engine` first (the heart:
  accept/evaluate/commit decision flow).
- Generalize the contract-upgrade pilot into wanna-u08's property-specific
  contract tests.
- wanna-9nc (README) documents the validated architecture.

## Decisions

- **Vitest** over node:test: better testaruda adapter support for structured
  reporting; fast-check can be added later for property-based escalation.
- **Layout**: `src/catalog/` + `tests/catalog/` — implementation separated from
  conformance tests so contracts bind to tests, not to internals.
- **Language**: TypeScript, pinned by the spec predicates themselves.

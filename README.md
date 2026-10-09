# wanna

Spec-first conformance harness for an interaction system: a specodelic corpus
is the source of truth, every property in it is bound to a runnable contract
test, and git hooks make a red contract un-pushable.

## Pipeline

```
openspec/specs/<capability>/spec.md   specodelic corpus (30 capabilities, dual-format id: spec)
        │  spk lint                    corpus invariants (coverage, total_refs, guards, …)
        ▼
.espectacular/<capability>/<property>-holds.toml
        │                              one contract per spec property, binding to a vitest test
        ▼
tests/<capability>/*.test.ts          executable contracts (falsifiable: negative scenarios must fail)
        │
        ▼
ah check / ah check --run-tests       spec↔contract↔test correspondence, executed
```

- **Corpus** — `openspec/specs/` holds 30 capability specs in the specodelic
  format (YAML frontmatter `id: spec`, fixed-schema tables, States +
  Transitions model). `spk lint openspec` enforces the corpus-wide invariants;
  `spk graph`, `spk compile`, and `spk model-check` consume the same corpus.
- **Contracts** — every property in every spec gets a contract TOML under
  `.espectacular/` declaring which test file verifies it. `ah check` validates
  that correspondence structurally; `ah check --run-tests` also executes the
  bound tests.
- **Gates** — `lefthook.yml` runs all of the above as blocking git hooks. A
  broken contract that should fail and does not is as much a finding as a
  passing implementation with a violated spec; falsifiability was proven both
  ways (a deliberately broken implementation makes `ah check` exit 1 naming
  the violated test).

## Gate table

| Hook | Gate | Command | Fails when |
|---|---|---|---|
| pre-commit | specodelic | `spk lint openspec` | corpus invariant violated |
| pre-commit | pretender | `pretender check --staged --mode gate` | role/pattern violation in staged files |
| pre-commit | eslint | `npx eslint src` | boundary violation in `src/` (independent of the test layer) |
| pre-commit | espectacular | `ah check` | spec scenario ↔ contract ↔ test correspondence broken |
| pre-push | pretender | `pretender check src tests tools --mode gate` | violation in first-party code (scoped away from `node_modules` vendor noise) |
| pre-push | espectacular | `ah check --run-tests` | correspondence broken **or** a bound test fails |
| pre-push | testaruda | `testaruda select` | test discovery error (exit 20 = nothing selected = pass) |

All commands are blocking: non-zero exit aborts the commit/push.

## Implementation status

Two pilot capabilities are implemented as runtime machines with
transitions-and-properties test suites:

- `src/catalog/` — component-catalog (`tests/catalog/`)
- `src/engine/` — interaction-engine (`tests/engine/`)

The remaining 28 capabilities are tracked as beads tickets with a
dependency-ordered wave structure (`bd ready`); their specs are already
covered by corpus conformance contracts, so each ticket is a
red→green→refactor implementation against a pre-verified spec.

The composition-shell / review-workbench prototype is implemented
(`src/composition-shell/`, `src/review-workbench/`) with an executable
consumer example (`examples/review-workbench/`). Its documented capabilities
and limitations live in [`docs/review-quickstart.md`](docs/review-quickstart.md);
surface revision history lives in
`openspec/changes/add-composition-shell/compatibility.md`.

## Provenance

`interaction-uiux-amplification-specodelic-v2.zip` at the repo root is the
provenance artifact for the deployed corpus: the corpus under
`openspec/specs/` was deployed from it, then repaired to lint-clean
(81 findings). Do not regenerate the corpus from the zip casually — treat the
zip as read-only provenance and the corpus as the live source of truth.

## Workflow quick reference

```bash
just --global-justfile --list   # project commands, if any
bd ready                        # next available ticket
spk lint openspec               # corpus gates
ah check --run-tests            # correspondence + tests
npx vitest run                  # full suite
```

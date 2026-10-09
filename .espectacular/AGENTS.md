<!-- ah:managed:start -->
## espectacular

Run `ah check` to verify spec-test correspondence before committing.

- `ah check` — validate all deployed specs
- `ah check --changes <name>` — validate with a change overlay
- `ah init` — set up or refresh espectacular project files
- `ah doctor` — diagnose setup issues
- `ah explain <topic>` — playbook guidance for finding kinds and suggested actions
- `ah doctor --enable <adapter>` — write adapter config into .espectacular/config.toml
- `ah signals` — emit dont drift signals
<!-- ah:managed:end -->

Before acting on any `ah check` finding, run its `playbook_command` to get the canonical remediation steps. Use `ah explain <topic>` to look up the playbook for any finding kind.

## Scenario→test binding convention (wanna-y8j)

Every contract that binds behavior uses **scenario-scoped** vitest entries:

```toml
[[tests.vitest]]
flags = "--testNamePattern=<exact scenario test name>"
timeout_seconds = 120
```

Rules:

- **One entry per scenario**, scoped to the single test that verifies it
  (`ah explain scenario-scoped-tests`). Never include a whole file or suite —
  N contracts sharing a file means N full runs and blurred attribution.
- **Test names must derive from the scenario slug** so the pattern is
  mechanical to write and a typo fails via `no-tests-ran` instead of passing.
- **Never claim unimplemented properties pass.** Contracts for behavior that
  has not landed stay empty (no `[[tests.*]]`) until their real test exists;
  a `no-toml` structural finding is the honest state, not an error to paper
  over. Use change-overlay contracts (`.espectacular/changes/<change>/`) while
  behavior is in flight, promote to `.espectacular/<spec>/` on deployment.
- **Falsifiability is proven, not assumed**: the harness path was proven to
  report a deliberately failing sentinel (see
  `.wai/projects/wanna/research/2026-10-10-y8j-sentinel-red-evidence.md`).

## Gap note (wanna-9wu, 2026-10-10): skip-guarded consumer behavior tests

`tests/composition-shell/consumer-behavior.test.ts` implements all 11
consumer-example.md outcome rows as named executable tests (test names derive
from the scenario slugs: `first-review`, `stale-decision`, `stale-response`,
`new-review`, `shared-writers`, `duplicate-delivery`, `restart`,
`lost-acknowledgement`, `unsupported-or-empty`, `cancel-after-display`,
`incompatible-storage`). While the shell behavior is unimplemented the whole
suite is skip-guarded by a one-time `not implemented` probe
(`describe.skipIf(!behaviorLanded)`), so **no contract TOMLs were bound for
these scenarios** — binding a skipped test would claim passing evidence that
does not exist. The honest state remains the 22 expected `no-toml` findings.
When wanna-0te/15e/8k6/gcp land behavior (and remove the probe), add one
scenario-scoped `[[tests.vitest]] flags = "--testNamePattern=<slug>…"` entry per
green scenario under `.espectacular/changes/add-composition-shell/composition-shell/`.

Resolved surface gaps (wanna-gcp, 2026-10-09):
- The transitional skip-guard probes and the consumer-side
  `ExplicitCancelShell` extension were removed once behavior landed; the
  consumer suites run unconditionally and assert through the declared
  `shell.cancel` command and the `retiredReviews` projection field.
- One scenario-scoped contract TOML was added per green scenario (8 entries
  added with wanna-gcp: acknowledgement-lost-after-durable-write,
  composition-without-layer-internals, full-pipeline-via-the-shell,
  reload-retains-evaluation-evidence, restart-restores-the-review,
  retirement-only-on-explicit-command, retry-requires-refreshed-snapshot,
  surface-change-ships-a-compatibility-decision).

Resolved surface gaps (wanna-snh, 2026-10-10):
- The durable review-workbench adapter landed
  (src/review-workbench/adapters/review-indexeddb.ts, 15 contract tests in
  tests/review-workbench/review-indexeddb.test.ts). One scenario-scoped
  contract TOML was bound under the change overlay:
  adapter-conflicts-serialized (pattern: "independent connections from one
  base cannot apply"). The remaining 5 review-workbench scenarios stay
  unbound per the no-tests-ran rule: their behavior is owned by
  wanna-01q (review-revision-visible, stale-feedback-explained),
  wanna-9r2 (resume-outcomes-visible), wanna-2o8 (consumer-uses-public-surface)
  and wanna-zcq (reuse-comparison-complete).

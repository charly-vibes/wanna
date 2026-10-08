# Add Composition Shell for Resumable Artifact Review

## Why

A developer integrating a human review step currently has to compose isolated
layer interfaces and invent the coordination between them. Our first value
hypothesis is that Wanna can provide revision checks, duplicate-response handling,
and recovery through one public interface, reducing that application-specific work.

The first consumer is a local artifact-review workbench: an agent proposes revision
7, a human reviews it, revision 8 can invalidate the pending response, and restarting
preserves the review history and pending work. The outcome is a recorded review;
it grants no authorization and triggers no external action.

## What Changes

- Add `composition-shell`, a host-neutral public API for this bounded workflow.
- Specify the API usage example and expected outcomes before implementing behavior
  (see `consumer-example.md`); use its failing consumer contract to drive TDD.
- Define explicit representation mappings, policy eligibility, freshness at initial
  decision commit and response commit, atomic conditional persistence, scoped
  deduplication, provenance, and restart/reconciliation outcomes.
- Compose existing public barrels. The shell owns documented boundary conversions;
  existing capabilities retain their domain rules. Any required change to an owning
  layer's semantics must have a corresponding spec delta before implementation.
- Develop the companion `add-workbench-spa` consumer alongside the shell. Import
  the public source barrel in-repo initially; package topology is a later decision.

## Scope and sequencing

1. Scenario, proposed API, and persistence contract.
2. Failing consumer contract, smallest shell path, and minimal review screen.
3. Shared-storage conflicts, stale decisions/responses, restart, and lost acknowledgement.
4. Second consumer and comparison with an application-specific implementation.
5. Distribution readiness decision, then packaging if justified.

This proposal includes the review slice and its conformance gates. It does not
promise composition of all 30 capabilities, arbitrary interaction kinds, production
multi-user hosting, capability execution, npm publication, or a workspace split.
The initial host is the workbench; programmatic consumption is exercised by its
companion reuse-validation task.

## Impact

- Affected specs: `composition-shell` (new).
- Affected implementation: `src/composition-shell/`, `tests/composition-shell/`,
  `.espectacular/composition-shell/`; proposed adapter and workbench ownership is
  described in `add-workbench-spa`.
- Companion change: `add-workbench-spa` owns the human experience, durable local
  adapter, and comparative value evidence. Neither change is delivered until its
  acceptance criteria pass; first-path development does not wait for packaging.
- Later distribution work remains tracked by wanna-zbn; no package topology or
  release commitment is made by this change.

## Success criteria

The consumer imports only the public shell barrel; policy decisions, revision
validation, replay handling, and recovery decisions remain behind that interface.
A real reviewer can complete and resume the example. A second consumer reuses the
same guarantees. The companion evaluation records remaining custom coordination
and integration effort against a direct implementation; unfavorable results trigger
API revision or a narrower positioning claim, not an automatic release.

# Add Artifact Review Workbench

## Why

The composition shell needs a real consumer to establish whether its interface
helps developers and whether a human can complete and resume a review. The first
value hypothesis is a reusable review step with revision checks, duplicate handling,
and recovery supplied by Wanna. A local browser workbench makes that claim testable.

## What Changes

- Add a minimal review screen showing the exact artifact revision, review request,
  feedback entry, recorded outcome, and pending/changed work after reopening.
- Semantic change found during implementation (wanna-9r2): the composition shell's
  projection gains an additive `aggregateVersion` field (surface 0.3.0) — conditional
  artifact changes are otherwise unreachable for consumers once invisible operations
  (decision commits, responses) advance the version past the last value they observed.
  Recorded in add-composition-shell compatibility.md and its spec delta.
- Add a local durable IndexedDB adapter outside the shell, with atomic conditional
  writes, replay and receipts, and explicit pending-operation reconciliation.
- Consume the shell public barrel; keep policy, lifecycle, revision, deduplication
  and recovery decisions inside the shell. A scripted agent fixture requests reviews.
- Develop the screen alongside the first shell path, then demonstrate failures and
  recovery with real durable storage. Packaging is not a prerequisite.
- Add a headless second consumer and a bounded direct-implementation comparison to
  measure reuse and remaining custom coordination before distribution work.

## Scope

The first workflow records feedback on an artifact revision. It neither grants
execution authority nor performs external actions. The local prototype has one
trusted application context; multi-user authentication, remote hosting, arbitrary
interaction kinds, rich editors and general agent capability invocation are deferred.

## Impact

- Affected specs: `review-workbench` (new).
- Proposed code: `examples/review-workbench/`, `adapters/review-indexeddb/`,
  `examples/review-headless/`, corresponding consumer and adapter tests, and
  `.espectacular/review-workbench/` contracts.
- Depends on the companion `add-composition-shell` API and acceptance scenarios.
  Adapter and screen implementation can start after that API contract is available;
  the complete acceptance suite requires shell recovery behavior.
- Distribution ticket wanna-zbn is gated by a recorded value/reuse decision.

## Success and decision gate

A person can review revision 7, see that revision 8 invalidates the pending response,
and reopen without losing recorded history or pending work. Two independent clients
cannot silently overwrite each other's response. A second consumer uses the same
public API without layer-internal imports or duplicated coordination rules.

Record integration time (including author familiarity), imports, adapter code and
custom coordination code for both Wanna consumers and an equivalent direct
implementation. Both alternatives must satisfy the same acceptance scenarios.
Report construction effort separately from marginal second-consumer effort.
A favorable reuse claim requires no new core behavior for the second consumer and
less consumer-owned coordination than the baseline. If either condition fails,
record revise/narrow/defer; do not treat a demo or test count as proof of value.

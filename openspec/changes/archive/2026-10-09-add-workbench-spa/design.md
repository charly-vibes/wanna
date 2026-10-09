# Design: Local Artifact Review Consumer

## Experience

A scripted agent fixture proposes review of a revision-specific text artifact.
The reviewer sees artifact identity, revision, content, why review was requested,
a feedback field and a submit action. Successful submission shows the recorded
feedback and reviewed revision. Cancellation is explicit. On a stale response,
preserve the draft locally, explain that the artifact changed, and require a fresh
review before resubmission; never silently rebind the draft to revision 8.
Reopening shows completed, pending and changed work from shell continuity data.
Uncertain writes display an unresolved outcome and disable mutation until the
shell reconciles. Recovery-required errors preserve existing data.

Use ordinary semantic HTML controls with labels and keyboard access. Fault injection,
artifact revision advancement and duplicate delivery belong in separate developer
demonstration controls; the reviewer flow shows only meaningful status and actions.

## Boundaries and storage

The workbench imports the shell public barrel through a source alias and consumes
its typed outcomes. It owns display, revision-specific content retrieval and local
unsent draft presentation. It does not independently implement revision acceptance,
policy evaluation, deduplication, authorization or recovery decisions.

An IndexedDB adapter owns authoritative local aggregate storage. A transaction spans
aggregate state, replay and operation receipts. Conditional revision checks execute
inside that transaction. A durable pending-operation record precedes an attempted
write; commit updates it with the receipt atomically. Reconciliation checks pending
status and the authoritative receipt and returns not_applied only when a write is
known to have aborted and cannot later commit. Open requests do not treat a missing
receipt as proof of non-application. Concurrent tab connections share the same store.

Adapter conformance tests use independent connections and the same database, and
reconstruct both shell and adapter. The browser acceptance test reloads the page;
in-memory fixtures alone do not establish durability. Before-write failure, after-
commit lost acknowledgement and unresolved recovery are injected at actual adapter
boundaries. The adapter implements the shell's declared port contract without
changing its semantics. Its code remains outside shell transitive dependencies.

## First path and subsequent checks

Begin with the consumer contract in the companion change. Develop a feedback screen
and the shell's first successful path together; use the durable adapter as soon as
its contract tests pass. Mark first-path demonstration separately from final delivery.
Then add revision change, independent writers, cancellation, restart and uncertain
outcomes. End-to-end tests assert visible results as well as committed state/replay.

The second consumer is a headless review client over the same public shell and
adapter contract. It must exercise stale input and resume as well as success; report
whether it forced any core changes. Compare with a small application-specific state
machine/persistence implementation of identical scenarios, retained as an evaluation
fixture rather than a production alternative. Document all excluded infrastructure
and distinguish cold-start costs from reuse costs. Claims remain local to this slice.

## Delivery boundary

No workspace split, npm publication or hosted service is required. A distribution
decision follows the evidence report. If proceeding, wanna-zbn determines package
layout and validates emitted exports/types in a fresh consumer. Semantic changes
found during implementation update the relevant proposal before applying the change.

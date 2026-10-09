# Review composition quickstart

This documents the **actual implemented** review-composition surface (surface
version **0.3.0**, see `openspec/changes/archive/2026-10-09-add-composition-shell/compatibility.md`)
as exercised by the executable consumer example (`examples/review-workbench/`)
and the executable consumer tests (`tests/composition-shell/`,
`tests/review-workbench/`). Nothing here is a planned or aspirational API — a
documentation contract test (`tests/review-workbench/review-docs.test.ts`)
fails if any documented shell call is not demonstrated by the executable
consumer code. Every section is verified — the quickstart documents only
demonstrated behavior, and the doc-contract test makes doc drift from the
public surface a red contract.

## What this is — and what it is not

- The shell **records review outcomes** (pending, completed, changed, retired,
  with provenance). It does **not authorize anyone to review and it does not
  perform external actions**: there is no publish, notify or deploy step, and
  no authorization decision lives in this surface. A host that needs review
  outcomes to drive authorization or external actions wires that itself,
  downstream of the recorded projection.
- This is a **local prototype**: consumers use in-repo source aliases
  (`@wanna/composition-shell`, `@wanna/review-indexeddb`) and the durable
  adapter is exercised through `fake-indexeddb` in tests. There is **no npm
  package, no publication and no cross-package compatibility claim** —
  distribution is tracked separately (wanna-zbn) and is not part of this v0.
- **Provisional source-consumer compatibility (v0):** the supported consumers
  are the in-repo ones — `examples/review-workbench/` (the consumer example)
  and the consumer test suites. Any *second* consumer must use this same
  public surface (no shell-internal imports). Surface revisions are additive
  so far (0.1.0 → 0.2.0 → 0.3.0); the compatibility record is the authority
  on what changed per revision.

## Construction

Open a session shell over a declared persistence port. The result is typed —
handle all three kinds:

```ts
import { openReviewSession } from "@wanna/composition-shell"; // + ReviewPolicy/ReviewCatalog types
import { createReviewIndexDbPort } from "@wanna/review-indexeddb"; // in-repo source aliases (no npm package)

const key = { sessionId: "session-1", taskId: "artifact-1" };
const open = await openReviewSession({
  key,
  policy: { policyVersion: "fixture-policy-1" }, // host-declared, shape per ReviewPolicy type
  catalog: { catalogVersion: "fixture-catalog-1" }, // host-declared, shape per ReviewCatalog type
  port, // the declared ReviewPersistencePort — createReviewIndexDbPort(...) (durable) or a test store
});
if (open.kind !== "ready") {
  // "unavailable" (storage could not be read) or "recovery_required"
  // (existing data is corrupt/incompatible). Existing data is preserved.
  return;
}
const shell = open.shell;
```

Opening a key with no persisted session still yields a `ready` shell — the
session is not persisted until the first operation commits.

## Initial write (conditional commit)

The initial artifact revision is created through `updateArtifact` with a
**null expected version** — the shell's conditional commit creates the
initial aggregate; a re-open that repeats the same operation returns
`duplicate`, never a second mutation:

```ts
const update = await shell.updateArtifact({
  operationId: "artifact-revision-7",
  expectedAggregateVersion: null,
  revision: 7,
  contentRef: "artifact-1/revisions/7",
});
```

## Evaluate → commit → project → respond

The scripted request path used by the executable example: evaluate an
interaction need, commit the returned decision, then project and submit
feedback.

```ts
const decision = await shell.evaluateNeed({
  kind: "review_artifact",
  target: "artifact-1",
  taskRevision: 7,
  proposalId: "proposal-7",
  evidenceRefs: ["artifact-1/revisions/7"],
  evidenceStrength: "sufficient",
});
if (decision.kind !== "decided") return; // typed refusal; nothing opened
const committed = await shell.commitDecision({
  operationId: "create-review-7",
  decisionId: decision.id,
});
if (committed.kind !== "committed") return;
const view = shell.project(); // taskRevision, interactionId, status, provenance
const outcome = await shell.submit({
  eventId: "feedback-7",
  interactionId: view.interactionId,
  expectedTaskRevision: 7, // the revision the reviewer actually saw
  expectedInteractionRevision: view.interactionRevision,
  feedback: "The explanation needs one concrete example.",
});
```

Handle every submit outcome explicitly — each is a typed, distinct contract:

| Outcome | Meaning | Consumer obligation |
|---|---|---|
| `recorded` | The completion committed for the stated revision. | Render the completion; stop. |
| `stale` | The artifact or interaction changed since the reviewer's view. | **Preserve the draft**, show what changed, and let the reviewer start a fresh review of the current revision. Never silently retarget the feedback to a revision the reviewer did not see. |
| `duplicate` | This event id was already recorded (retry after lost ack, or re-delivery). | Nothing changed; say so and stop. |
| `unavailable` | Storage refused or could not be reached. | Preserve the draft; retry is allowed. |
| `unknown_effect` | The write may or may not have applied. | **Do not retry.** Reconcile first (below). |

## Stale refusals and refresh

After a cross-writer precondition rejection the shell refuses further
mutations with `stale` until a fresh authoritative snapshot arrives — the
refusal happens before any port contact. `refresh()` is the recovery path:

```ts
const after = await shell.refresh();
if (after.kind === "refreshed") {
  const fresh = after.projection; // authoritative revision and history
}
```

## Uncertain effects and reconcile

After an `unknown_effect` the shell blocks mutations with `unknown_effect`
until the operation's outcome is proven. `reconcile(operationId)` asks the
port what actually happened; it never repeats a committed response:

```ts
const reconciled = await shell.reconcile("feedback-7");
// "applied"      → the feedback did commit; render the completion
// "not_applied"  → the write never landed; retrying the review is now allowed
// "unknown_effect" → still uncertain; reconcile again later
```

## Explicit cancellation

Retirement only happens through the declared command — never implicitly
through artifact changes or evaluation. History remains inspectable:

```ts
const cancel = await shell.cancel({
  operationId: "cancel-review-7",
  interactionId: view.interactionId,
});
// "retired" | "stale" | "duplicate" | "unavailable" | "unknown_effect"
```

## Resume

Durable state lives behind the port, not in the shell instance. A new shell
opened over the same port and key restores the revision, completed/pending/
retired reviews and provenance. Only committed operations (and their receipts)
survive — a decision evaluated but never committed is not durable and is
re-evaluated after restart. Only a fresh consumer demonstrates the resume
path; a re-open in the same process never returns `duplicate`.

The projection also carries `aggregateVersion` — the authoritative version the
next conditional commit must carry.

```ts
const resumed = await openReviewSession({ key, policy, catalog, port });
if (resumed.kind !== "ready") return;
const continuity = resumed.shell.project();
```

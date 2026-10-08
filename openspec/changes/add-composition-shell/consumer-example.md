# Proposed consumer contract: artifact review

This is design pseudocode, not an existing runnable API. The first implementation
contract resolves these names into exported types and tests without importing layer
internals. Artifact contents stay with the host under a revision-specific reference.

```ts
const key = { sessionId: "session-1", taskId: "artifact-1" };
const shell = await openReviewSession({
  key,
  policy, catalog, port, // trusted immutable inputs; declared persistence required
});
await shell.updateArtifact({
  operationId: "artifact-revision-7", expectedAggregateVersion: null,
  revision: 7, contentRef: "artifact-1/revisions/7",
});
const decision = await shell.evaluateNeed({
  kind: "review_artifact", target: "artifact-1", taskRevision: 7,
  proposalId: "proposal-7", evidenceRefs: ["artifact-1/revisions/7"],
  evidenceStrength: "sufficient",
});
if (decision.kind === "decided") {
  const committed = await shell.commitDecision({
    operationId: "create-review-7", decisionId: decision.id,
  });
  if (committed.kind === "committed") {
    const view = shell.project(); // reviewed revision, feedback, provenance, continuity
    const result = await shell.submit({
      eventId: "feedback-7", interactionId: view.interactionId,
      expectedTaskRevision: 7, expectedInteractionRevision: view.interactionRevision,
      feedback: "The explanation needs one concrete example.",
    });
    // Handle recorded, stale, duplicate, unavailable and unknown_effect explicitly.
  }
}
// A new shell using the same port loads receipts and pending/completed reviews.
const resumed = await openReviewSession({ key, policy, catalog, port });
const continuity = resumed.project();
// Unknown effects require reconcile(operationId); refresh() handles stale snapshots.
```

`openReviewSession` above unwraps a successful open for readability. Its actual
public result must also represent `unavailable` and `recovery_required`. Opening a
missing key leaves an unpersisted session shell; `updateArtifact` creates the initial
aggregate through compare-and-commit with null expected version. The first contract
must include those branches. Decision IDs bind immutable evaluated inputs and are
local until committed; an uncommitted decision is reevaluated after restart.

## Expected outcomes (acceptance inputs and outputs)

| Case | Inputs / action | Observable result |
|---|---|---|
| First review | Revision 7; eligible review need; valid feedback | One completed review for revision 7, with feedback and provenance persisted; no authorization or external action. |
| Stale decision | Evaluate revision 7, update artifact to 8, commit old decision | Typed stale decision; no review for revision 8 created from revision 7 inputs. |
| Stale response | Open review 7, update artifact to 8, submit old feedback | Typed stale response; feedback is not accepted for revision 8; refresh explains changed/pending work. |
| New review | Explicitly supersede review 7, evaluate and commit review 8 | New identity and revision binding; old history remains inspectable. |
| Shared writers | Two independent shells load the same version and submit distinct responses | One applied transaction, one conflict; one completion and consistent replay. |
| Duplicate delivery | Retry a recorded event ID, including after reconstruction | No second state mutation; typed duplicate correlated with the stored receipt. |
| Restart | Destroy shell and host; reopen the same durable store | Original revision, completed/pending/changed work and provenance restored. |
| Lost acknowledgement | Storage commits but acknowledgement is lost | Unknown outcome blocks mutation until reconciliation; replay never repeats the committed response. |
| Unsupported or empty | Unsupported kind, malformed need or no eligible candidate | Typed refusal or no-candidate result with exclusions; no active review created. |
| Cancel after display | Project active review, issue explicit cancel | Review retires through the permitted command; history remains available. |
| Incompatible storage | Unsupported version or corrupt persisted replay | Recovery-required outcome; existing data preserved. |

The host owns content loading and display. The shell owns revision validation,
decision eligibility, lifecycle, deduplication and recovery classification. The
workbench may expose fault controls for demonstrations but cannot duplicate those
rules. The second consumer must use the same surface.

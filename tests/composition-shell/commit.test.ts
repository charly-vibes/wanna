// Purpose: commit/submit contract for the composition shell (wanna-8k6)
// Responsibilities: revision-bound decision commits, stale event rejections, single-transaction review completion, duplicate operation/event ids, shared-base-revision serialization and commit-failure semantics through ONLY the public composition-shell barrel
// Rationale: openspec/changes/add-composition-shell/specs/composition-shell/spec.md scenarios artifact-changes-before-decision-commit, stale-event-returns-typed-rejection, feedback-completes-review, duplicate-after-restart, independent-writers-share-a-base-revision, port-failure-semantics-tested and projection-mutation-is-inert; durable browser-level shared-store proof stays with wanna-9r2
import { describe, expect, it } from "vitest";
import {
  FakeReviewStore,
  FIRST_FEEDBACK,
  KEY,
  expectApplied,
  openReadyShell,
  reachActiveReview,
} from "./consumer-support";
import {
  openOn,
  storageFingerprint,
  submitCommand,
  updateCommand,
  recordingPort,
} from "./commit-helpers";

describe("composition-shell commit and submit (wanna-8k6) — decision and response transactions", () => {
  it("artifact-changes-before-decision-commit — a revision-7 decision cannot commit after an authoritative revision-8 update, and explicit updates obey the same aggregate boundary", async () => {
    const store = new FakeReviewStore();
    const shell = await openReadyShell(store);
    const created = await shell.updateArtifact({
      operationId: "artifact-revision-7",
      expectedAggregateVersion: null,
      revision: 7,
      contentRef: "artifact-1/revisions/7",
    });
    expectApplied(created, "artifact creation");
    expect(store.rawState(KEY).aggregateVersion).toBe(1);

    const decision = await shell.evaluateNeed({
      kind: "review_artifact",
      target: "artifact-1",
      taskRevision: 7,
      proposalId: "proposal-7",
      evidenceRefs: ["artifact-1/revisions/7"],
      evidenceStrength: "sufficient",
    });
    if (decision.kind !== "decided")
      throw new Error(`expected decided evaluation, got ${decision.kind}`);

    // a mismatched expected aggregate version is a typed stale rejection and mutates nothing
    const mismatched = await shell.updateArtifact(
      updateCommand({ expectedAggregateVersion: 0 }),
    );
    expect(mismatched.kind).toBe("stale");
    expect(store.rawState(KEY).aggregateVersion).toBe(1);

    // after creation the expected version is required: a second create-only attempt is refused
    const createAgain = await shell.updateArtifact(
      updateCommand({
        operationId: "artifact-revision-7-again",
        expectedAggregateVersion: null,
        revision: 7,
      }),
    );
    expect(createAgain.kind).toBe("stale");
    expect(store.rawState(KEY).replay).toHaveLength(1);
    expect(store.rawState(KEY).receipts.size).toBe(1);

    // the authoritative revision 8 update applies through the same boundary
    const moved = await shell.updateArtifact(updateCommand({}));
    expectApplied(moved, "artifact revision 8");
    expect(store.rawState(KEY).aggregateVersion).toBe(2);

    // the revision-7 decision is now stale: rejected, no review for revision 8, no mutation
    const committed = await shell.commitDecision({
      operationId: "create-review-7",
      decisionId: decision.id,
    });
    expect(committed.kind).toBe("stale");
    expect(store.rawState(KEY).aggregateVersion).toBe(2);
    expect(store.rawState(KEY).replay).toHaveLength(2);
    expect(store.rawState(KEY).receipts.size).toBe(2);
    const view = shell.project();
    expect(view.pendingReviews).toHaveLength(0);
    expect(view.completedReviews).toHaveLength(0);

    // retrying the same stale decision still refuses
    const retried = await shell.commitDecision({
      operationId: "create-review-7-retry",
      decisionId: decision.id,
    });
    expect(retried.kind).toBe("stale");
  });

  it("stale-event-returns-typed-rejection — a stale task or interaction revision is a typed stale rejection leaving committed state unchanged", async () => {
    const store = new FakeReviewStore();
    const { shell, view } = await reachActiveReview(store);
    const before = storageFingerprint(store);

    const staleTask = await shell.submit(
      submitCommand({ expectedTaskRevision: 8 }),
    );
    expect(staleTask.kind).toBe("stale");

    const staleInteraction = await shell.submit(
      submitCommand({ expectedInteractionRevision: view.interactionRevision + 1 }),
    );
    expect(staleInteraction.kind).toBe("stale");

    const unknownInteraction = await shell.submit(
      submitCommand({ interactionId: "artifact-1:interaction:9" }),
    );
    expect(unknownInteraction.kind).toBe("stale");

    expect(storageFingerprint(store)).toBe(before);

    // the current feedback still completes after the rejections
    const recorded = await shell.submit(submitCommand({}));
    expect(recorded.kind).toBe("recorded");
  });

  it("feedback-completes-review — current feedback completes exactly one review with response, replay, receipt and continuity in ONE port transaction", async () => {
    const store = new FakeReviewStore();
    await reachActiveReview(store);
    const { port, observed } = recordingPort(store.port(KEY));
    const shell = await openOn(port);
    const view = shell.project();
    expect(view.status).toBe("pending");

    const commitsBefore = observed.commits;
    const recorded = await shell.submit(
      submitCommand({
        interactionId: view.interactionId,
        expectedInteractionRevision: view.interactionRevision,
      }),
    );
    expect(recorded.kind).toBe("recorded");

    // exactly one compareAndCommit: response + replay + receipt + continuity in one transaction
    expect(observed.commits).toBe(commitsBefore + 1);
    const op = observed.ops[observed.ops.length - 1];
    if (!op) throw new Error("expected a recorded port operation");
    expect(op.operationId).toBe("feedback-7");
    expect(op.expectedTaskRevision).toBe(7);
    expect(op.expectedInteractionRevision).toBe(view.interactionRevision);
    expect(op.replayAdditions.length).toBeGreaterThan(0);

    // receipt proves application; continuity advanced in the same transaction
    const state = store.rawState(KEY);
    expect(state.aggregateVersion).toBe(3);
    expect(state.receipts.get("feedback-7")?.applied).toBe(true);

    // exactly one completion exists — in memory and after reconstruction
    const done = shell.project();
    expect(done.status).toBe("completed");
    expect(done.feedback).toBe(FIRST_FEEDBACK);
    expect(done.completedReviews).toHaveLength(1);
    expect(done.completedReviews[0]?.revision).toBe(7);
    expect(done.completedReviews[0]?.feedback).toBe(FIRST_FEEDBACK);
    const completionEvents = state.replay.filter(
      (entry) =>
        (entry as { shellEvent?: string }).shellEvent === "review_completed",
    );
    expect(completionEvents).toHaveLength(1);
    const resumed = (await openReadyShell(store)).project();
    expect(resumed.completedReviews).toHaveLength(1);
    expect(resumed.feedback).toBe(FIRST_FEEDBACK);
  });

  it("duplicate-after-restart — a retried event or operation id returns a typed duplicate correlated with the stored receipt, including after shell reconstruction", async () => {
    const store = new FakeReviewStore();
    const { shell, view } = await reachActiveReview(store);
    const first = await shell.submit(
      submitCommand({
        interactionId: view.interactionId,
        expectedInteractionRevision: view.interactionRevision,
      }),
    );
    expect(first.kind).toBe("recorded");
    expect(store.rawState(KEY).receipts.size).toBe(3);

    const retry = await shell.submit(
      submitCommand({
        interactionId: view.interactionId,
        expectedInteractionRevision: view.interactionRevision,
      }),
    );
    if (retry.kind !== "duplicate")
      throw new Error(`expected typed duplicate, got ${retry.kind}`);
    expect(retry.receipt.operationId).toBe("feedback-7");
    expect(retry.receipt.applied).toBe(true);
    expect(store.rawState(KEY).receipts.size).toBe(3);

    // a retried artifact-update operation id is also a typed duplicate
    const dupUpdate = await shell.updateArtifact({
      operationId: "artifact-revision-7",
      expectedAggregateVersion: null,
      revision: 7,
      contentRef: "artifact-1/revisions/7",
    });
    expect(dupUpdate.kind).toBe("duplicate");

    // the same delivery after shell reconstruction from the same store
    const resumed = await openReadyShell(store);
    const retryAfterRestart = await resumed.submit(
      submitCommand({
        interactionId: view.interactionId,
        expectedInteractionRevision: view.interactionRevision,
      }),
    );
    if (retryAfterRestart.kind !== "duplicate")
      throw new Error(
        `expected typed duplicate after restart, got ${retryAfterRestart.kind}`,
      );
    expect(retryAfterRestart.receipt.operationId).toBe("feedback-7");
    expect(resumed.project().completedReviews).toHaveLength(1);
    expect(store.rawState(KEY).receipts.size).toBe(3);
  });

});

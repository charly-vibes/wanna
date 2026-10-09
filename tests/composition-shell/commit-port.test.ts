// Purpose: commit-boundary port semantics for the composition shell (wanna-8k6)
// Responsibilities: shared-base-revision serialization across two shells, commit-failure mapping at every commit boundary, and projection-tamper inertness through ONLY the public composition-shell barrel
// Rationale: split from commit.test.ts for pretender file limits; durable browser-level shared-store proof stays with wanna-9r2
import { describe, expect, it } from "vitest";
import {
  FakeReviewStore,
  FIRST_FEEDBACK,
  KEY,
  openReadyShell,
  reachActiveReview,
} from "./consumer-support";
import {
  openOn,
  storageFingerprint,
  throwingCommitPort,
  updateCommand,
  submitCommand,
  forcedOutcomePort,
} from "./commit-helpers";

describe("composition-shell commit-boundary port semantics (wanna-8k6)", () => {
  it("independent-writers-share-a-base-revision — two shells sharing one base version produce one applied response and one typed conflict (unit fake-port proof)", async () => {
    const store = new FakeReviewStore();
    await reachActiveReview(store);
    const shellA = await openReadyShell(store);
    const shellB = await openReadyShell(store);
    const viewA = shellA.project();
    const viewB = shellB.project();
    expect(viewA.interactionId).toBe(viewB.interactionId);
    expect(viewA.interactionRevision).toBe(viewB.interactionRevision);

    const [outcomeA, outcomeB] = await Promise.all([
      shellA.submit(
        submitCommand({
          eventId: "feedback-a",
          interactionId: viewA.interactionId,
          expectedInteractionRevision: viewA.interactionRevision,
          feedback: "from A",
        }),
      ),
      shellB.submit(
        submitCommand({
          eventId: "feedback-b",
          interactionId: viewB.interactionId,
          expectedInteractionRevision: viewB.interactionRevision,
          feedback: "from B",
        }),
      ),
    ]);
    expect([outcomeA.kind, outcomeB.kind].sort()).toEqual([
      "recorded",
      "stale",
    ]);

    // exactly one completion exists in storage; replaying after restart adds nothing
    const responseReceipts = [
      ...store.rawState(KEY).receipts.values(),
    ].filter(
      (receipt) =>
        receipt.operationId === "feedback-a" ||
        receipt.operationId === "feedback-b",
    );
    expect(responseReceipts).toHaveLength(1);
    const resumed = (await openReadyShell(store)).project();
    expect(resumed.completedReviews).toHaveLength(1);
    expect(resumed.feedback).toBe(
      outcomeA.kind === "recorded" ? "from A" : "from B",
    );
  });

  it("port-failure-semantics-tested — commit-boundary failures at every shell commit boundary map to the declared typed outcomes without mutation", async () => {
    // declared unavailable propagates and mutates nothing
    const unavailableStore = new FakeReviewStore();
    await reachActiveReview(unavailableStore);
    const unavailableShell = await openOn(
      forcedOutcomePort(unavailableStore.port(KEY), { kind: "unavailable" }),
    );
    const before = storageFingerprint(unavailableStore);
    const decision = await unavailableShell.evaluateNeed({
      kind: "review_artifact",
      target: "artifact-1",
      taskRevision: 7,
      proposalId: "proposal-7",
      evidenceRefs: ["artifact-1/revisions/7"],
      evidenceStrength: "sufficient",
    });
    if (decision.kind !== "decided")
      throw new Error(`expected decided evaluation, got ${decision.kind}`);
    const unavailableUpdate = await unavailableShell.updateArtifact(
      updateCommand({}),
    );
    expect(unavailableUpdate.kind).toBe("unavailable");
    const unavailableCommit = await unavailableShell.commitDecision({
      operationId: "create-review-7",
      decisionId: decision.id,
    });
    expect(unavailableCommit.kind).toBe("unavailable");
    const unavailableSubmit = await unavailableShell.submit(
      submitCommand({}),
    );
    expect(unavailableSubmit.kind).toBe("unavailable");
    expect(storageFingerprint(unavailableStore)).toBe(before);
    expect(unavailableStore.rawState(KEY).aggregateVersion).toBe(2);
    expect(unavailableStore.rawState(KEY).receipts.size).toBe(2);

    // declared unknown_effect propagates; the durable effect is real but unacknowledged
    const unknownStore = new FakeReviewStore();
    await reachActiveReview(unknownStore);
    unknownStore.loseNextAck();
    const unknownShell = await openReadyShell(unknownStore);
    const unknownSubmit = await unknownShell.submit(submitCommand({}));
    expect(unknownSubmit.kind).toBe("unknown_effect");
    expect(unknownStore.rawState(KEY).receipts.get("feedback-7")?.applied).toBe(
      true,
    );

    // a thrown commit failure is never mapped to certainly-not-applied unavailable
    const thrownStore = new FakeReviewStore();
    await reachActiveReview(thrownStore);
    const thrownShell = await openOn(throwingCommitPort(thrownStore.port(KEY)));
    const thrownSubmit = await thrownShell.submit(submitCommand({}));
    expect(thrownSubmit.kind).toBe("unknown_effect");
    const thrownUpdate = await thrownShell.updateArtifact(updateCommand({}));
    expect(thrownUpdate.kind).toBe("unknown_effect");
    expect(thrownStore.rawState(KEY).aggregateVersion).toBe(2);
    expect(thrownStore.rawState(KEY).receipts.size).toBe(2);
  });

  it("projection-mutation-is-inert — tampering with a returned projection after commit and submit changes nothing in storage", async () => {
    const store = new FakeReviewStore();
    const { shell, view } = await reachActiveReview(store);
    const submitted = await shell.submit(
      submitCommand({
        interactionId: view.interactionId,
        expectedInteractionRevision: view.interactionRevision,
      }),
    );
    expect(submitted.kind).toBe("recorded");
    const before = storageFingerprint(store);

    const tampered = shell.project();
    (tampered as { taskRevision: number }).taskRevision = 99;
    (tampered as { status: string }).status = "retired";
    (tampered.completedReviews as unknown[]).push("junk");
    const review = tampered.completedReviews[0] as unknown as {
      feedback: string;
      provenance: { evidenceRefs: string[] };
    };
    review.feedback = "tampered";
    review.provenance.evidenceRefs.push("junk");

    const after = shell.project();
    expect(after.status).toBe("completed");
    expect(after.taskRevision).toBe(7);
    expect(after.completedReviews).toHaveLength(1);
    expect(after.completedReviews[0]?.feedback).toBe(FIRST_FEEDBACK);
    expect(after.completedReviews[0]?.provenance.evidenceRefs).toEqual([
      "artifact-1/revisions/7",
    ]);
    expect(storageFingerprint(store)).toBe(before);
  });

  it("projection-carries-authoritative-version — after every applied operation the projection's aggregateVersion is exactly what the next conditional commit must expect", async () => {
    const store = new FakeReviewStore();
    const { shell, view } = await reachActiveReview(store);

    // the version advances invisibly through the decision commit and the
    // response; the projection must still carry the authoritative value
    const submitted = await shell.submit(
      submitCommand({
        interactionId: view.interactionId,
        expectedInteractionRevision: view.interactionRevision,
      }),
    );
    expect(submitted.kind).toBe("recorded");
    const after = shell.project();
    expect(after.aggregateVersion).toBeGreaterThan(view.aggregateVersion);

    // the exposed version is exactly the port precondition: an artifact change
    // conditioned on it applies without any consumer-side version tracking
    const advanced = await shell.updateArtifact({
      operationId: "artifact-revision-8",
      expectedAggregateVersion: after.aggregateVersion,
      revision: 8,
      contentRef: "artifact-1/revisions/8",
    });
    expect(advanced).toEqual({ kind: "applied", aggregateVersion: after.aggregateVersion + 1 });
    expect(shell.project().aggregateVersion).toBe(after.aggregateVersion + 1);
  });
});

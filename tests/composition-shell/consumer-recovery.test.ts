// Purpose: consumer behavior contract, part 2 of 2 — concurrency, recovery and reconciliation (consumer-example.md outcome table)
// Responsibilities: shared-writers, duplicate-delivery, restart, lost-acknowledgement, cancel-after-display and incompatible-storage scenarios through ONLY the public composition-shell barrel
// Rationale: openspec/changes/add-composition-shell/consumer-example.md + specs (change overlay); wanna-9wu; fakes/helpers and the transitional skip guard live in ./consumer-support
import { describe, expect, it } from "vitest";
import * as shellApi from "../../src/composition-shell";
import {
  CATALOG,
  expectApplied,
  FakeReviewStore,
  FIRST_FEEDBACK,
  KEY,
  openReadyShell,
  POLICY,
  reachActiveReview,
} from "./consumer-support";

describe(
  "composition-shell consumer behavior — recovery and concurrency (reconcile and cancel landed: wanna-gcp)",
  () => {
    it("shared-writers — two shells on one base version apply exactly one of two distinct responses", async () => {
      const store = new FakeReviewStore();
      await reachActiveReview(store);

      const shellA = await openReadyShell(store);
      const shellB = await openReadyShell(store);
      const viewA = shellA.project();
      const viewB = shellB.project();
      expect(viewA.interactionId).toBe(viewB.interactionId);
      expect(viewA.interactionRevision).toBe(viewB.interactionRevision);

      const [outcomeA, outcomeB] = await Promise.all([
        shellA.submit({
          eventId: "feedback-a",
          interactionId: viewA.interactionId,
          expectedTaskRevision: 7,
          expectedInteractionRevision: viewA.interactionRevision,
          feedback: "from A",
        }),
        shellB.submit({
          eventId: "feedback-b",
          interactionId: viewB.interactionId,
          expectedTaskRevision: 7,
          expectedInteractionRevision: viewB.interactionRevision,
          feedback: "from B",
        }),
      ]);
      const outcomes = [outcomeA, outcomeB];
      expect(outcomes.filter((o) => o.kind === "recorded")).toHaveLength(1);
      expect(outcomes.filter((o) => o.kind === "stale")).toHaveLength(1);
      const recordedFeedback =
        outcomeA.kind === "recorded" ? "from A" : "from B";

      // consistent replay after reconstruction: exactly one completion
      const resumed = (await openReadyShell(store)).project();
      expect(resumed.completedReviews).toHaveLength(1);
      expect(resumed.feedback).toBe(recordedFeedback);
    });

    it("duplicate-delivery — a retried event id yields a typed duplicate correlated with the stored receipt, also after reconstruction", async () => {
      const store = new FakeReviewStore();
      const { shell } = await reachActiveReview(store);
      const view = shell.project();
      const first = await shell.submit({
        eventId: "feedback-7",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (first.kind !== "recorded")
        throw new Error(`expected recorded submission, got ${first.kind}`);

      const retry = await shell.submit({
        eventId: "feedback-7",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (retry.kind !== "duplicate")
        throw new Error(`expected typed duplicate, got ${retry.kind}`);
      expect(retry.receipt.operationId).toBe("feedback-7");
      expect(retry.receipt.applied).toBe(true);

      // same delivery after reconstruction: still typed duplicate, no second mutation
      const resumedShell = await openReadyShell(store);
      const retryAfterReconstruction = await resumedShell.submit({
        eventId: "feedback-7",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (retryAfterReconstruction.kind !== "duplicate") {
        throw new Error(
          `expected typed duplicate after reconstruction, got ${retryAfterReconstruction.kind}`,
        );
      }
      expect(retryAfterReconstruction.receipt.operationId).toBe("feedback-7");
      const after = resumedShell.project();
      expect(after.completedReviews).toHaveLength(1);
      expect(after.feedback).toBe(FIRST_FEEDBACK);
    });

    it("restart — reopening the same durable store restores revision, completed work and provenance", async () => {
      const store = new FakeReviewStore();
      const { shell } = await reachActiveReview(store);
      const view = shell.project();
      const submitted = await shell.submit({
        eventId: "feedback-7",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (submitted.kind !== "recorded")
        throw new Error(`expected recorded submission, got ${submitted.kind}`);
      const originalView = shell.project();

      // destroy the shell and host state; reopen the same durable store
      const resumed = (await openReadyShell(store)).project();
      expect(resumed.taskRevision).toBe(7);
      expect(resumed.status).toBe("completed");
      expect(resumed.feedback).toBe(FIRST_FEEDBACK);
      expect(resumed.interactionId).toBe(originalView.interactionId);
      expect(resumed.completedReviews).toHaveLength(1);
      expect(resumed.completedReviews[0]?.revision).toBe(7);
      expect(resumed.completedReviews[0]?.provenance.proposalId).toBe(
        "proposal-7",
      );
      expect(resumed.completedReviews[0]?.provenance.policyVersion).toBe(
        POLICY.policyVersion,
      );
    });

    it("lost-acknowledgement — an unknown outcome blocks mutation until reconcile and replay never repeats the committed response", async () => {
      const store = new FakeReviewStore();
      const { shell } = await reachActiveReview(store);
      const view = shell.project();

      store.loseNextAck(); // storage commits, acknowledgement is lost
      const lost = await shell.submit({
        eventId: "feedback-7",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (lost.kind !== "unknown_effect")
        throw new Error(`expected unknown_effect, got ${lost.kind}`);

      // mutation stays blocked until reconciliation — no second application
      const blocked = await shell.submit({
        eventId: "feedback-8",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: "premature follow-up",
      });
      expect(blocked.kind).not.toBe("recorded");

      const reconciled = await shell.reconcile("feedback-7");
      if (reconciled.kind !== "applied")
        throw new Error(
          `expected applied reconciliation, got ${reconciled.kind}`,
        );

      // replay never repeats the committed response: exactly one completion
      const resumed = (await openReadyShell(store)).project();
      expect(resumed.completedReviews).toHaveLength(1);
      expect(resumed.feedback).toBe(FIRST_FEEDBACK);
    });

    it("cancel-after-display — an explicit cancel retires the displayed review and history remains available", async () => {
      const store = new FakeReviewStore();
      const { shell } = await reachActiveReview(store);
      const view = shell.project();
      expect(view.status).toBe("pending"); // displayed to the host

      const cancelled = await shell.cancel({
        operationId: "cancel-review-7",
        interactionId: view.interactionId,
      });
      expect(cancelled.kind).toBe("retired");
      expect(shell.project().status).toBe("retired");

      // history remains available after reconstruction, including the retired review
      const history = (await openReadyShell(store)).project();
      expect(
        [
          ...history.completedReviews,
          ...history.pendingReviews,
          ...history.retiredReviews,
        ].some((r) => r.revision === 7),
      ).toBe(true);
      expect(history.retiredReviews.some((r) => r.revision === 7)).toBe(true);
    });

    it("incompatible-storage — an unsupported stored version yields recovery_required and preserves existing data", async () => {
      const store = new FakeReviewStore();
      const shell = await openReadyShell(store);
      const created = await shell.updateArtifact({
        operationId: "artifact-revision-7",
        expectedAggregateVersion: null,
        revision: 7,
        contentRef: "artifact-1/revisions/7",
      });
      expectApplied(created, "artifact creation");
      const persistedBefore = store.rawState(KEY);
      const replayBefore = persistedBefore.replay.length;
      expect(replayBefore).toBeGreaterThan(0);

      // storage reports an unsupported schema version / corrupt replay on load
      store.setLoadOverride({ kind: "recovery_required" });
      const reopened = await shellApi.openReviewSession({
        key: KEY,
        policy: POLICY,
        catalog: CATALOG,
        port: store.port(KEY),
      });
      if (reopened.kind !== "recovery_required") {
        throw new Error(`expected recovery_required, got ${reopened.kind}`);
      }
      expect(reopened.reason.length).toBeGreaterThan(0);

      // existing data preserved — the failed open overwrote nothing
      const persistedAfter = store.rawState(KEY);
      expect(persistedAfter.aggregateVersion).toBe(
        persistedBefore.aggregateVersion,
      );
      expect(persistedAfter.replay).toHaveLength(replayBefore);
      expect(persistedAfter.receipts.size).toBe(persistedBefore.receipts.size);
    });
  },
);

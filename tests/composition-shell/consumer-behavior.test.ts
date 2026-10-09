// Purpose: consumer behavior contract, part 1 of 2 — core review flow and refusals (consumer-example.md outcome table)
// Responsibilities: first-review, stale-decision, stale-response, new-review and unsupported-or-empty scenarios through ONLY the public composition-shell barrel
// Rationale: openspec/changes/add-composition-shell/consumer-example.md + specs (change overlay); wanna-9wu; fakes/helpers and the transitional skip guard live in ./consumer-support
import { expect, it } from "vitest";
import * as shellApi from "../../src/composition-shell";
import {
  CATALOG,
  expectApplied,
  FakeReviewStore,
  FIRST_FEEDBACK,
  openReadyShell,
  POLICY,
  reachActiveReview,
} from "./consumer-support";

describe(
  // suite name keeps the historical guard note so the landed state stays self-explaining
  "composition-shell consumer behavior — core flow (first path landed: wanna-0te/15e/8k6)",
  () => {
    it("first-review — a revision-7 review completes with feedback and provenance persisted and no authorization or external action", async () => {
      const store = new FakeReviewStore();
      const { shell } = await reachActiveReview(store);
      const activeView = shell.project();
      expect(activeView.status).toBe("pending");

      const submitted = await shell.submit({
        eventId: "feedback-7",
        interactionId: activeView.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: activeView.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (submitted.kind !== "recorded")
        throw new Error(`expected recorded submission, got ${submitted.kind}`);

      const view = shell.project();
      expect(view.status).toBe("completed");
      expect(view.feedback).toBe(FIRST_FEEDBACK);
      expect(view.completedReviews).toHaveLength(1);
      const review = view.completedReviews[0];
      if (!review) throw new Error("expected one completed review");
      expect(review.revision).toBe(7);
      expect(review.feedback).toBe(FIRST_FEEDBACK);
      expect(review.provenance.proposalId).toBe("proposal-7");
      expect(review.provenance.evidenceRefs).toEqual([
        "artifact-1/revisions/7",
      ]);
      expect(review.provenance.policyVersion).toBe(POLICY.policyVersion);
      expect(review.provenance.catalogVersion).toBe(CATALOG.catalogVersion);

      // persisted, not only in-memory: reconstruction from the same store sees it
      const resumed = (await openReadyShell(store)).project();
      expect(resumed.status).toBe("completed");
      expect(resumed.feedback).toBe(FIRST_FEEDBACK);

      // no authorization or external action exists anywhere on the public surface
      const exportedFunctions = Object.entries(shellApi)
        .filter(([, value]) => typeof value === "function")
        .map(([name]) => name);
      expect(exportedFunctions).toEqual(["openReviewSession"]);
    });

    it("stale-decision — committing a revision-7 decision after the artifact moves to 8 is typed stale and creates no review for revision 8", async () => {
      const store = new FakeReviewStore();
      const shell = await openReadyShell(store);
      const created = await shell.updateArtifact({
        operationId: "artifact-revision-7",
        expectedAggregateVersion: null,
        revision: 7,
        contentRef: "artifact-1/revisions/7",
      });
      const createdVersion = expectApplied(created, "artifact creation");
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

      const moved = await shell.updateArtifact({
        operationId: "artifact-revision-8",
        expectedAggregateVersion: createdVersion,
        revision: 8,
        contentRef: "artifact-1/revisions/8",
      });
      expectApplied(moved, "artifact revision 8");

      const committed = await shell.commitDecision({
        operationId: "create-review-7",
        decisionId: decision.id,
      });
      if (committed.kind !== "stale")
        throw new Error(`expected typed stale decision, got ${committed.kind}`);

      const view = shell.project();
      expect(view.completedReviews).toHaveLength(0);
      expect(view.pendingReviews.every((r) => r.revision !== 8)).toBe(true);
    });

    it("stale-response — submitting old feedback after artifact 8 is typed stale and refresh explains the changed work", async () => {
      const store = new FakeReviewStore();
      const { shell } = await reachActiveReview(store);
      const activeView = shell.project();
      // reachActiveReview commits twice (artifact creation + decision commit),
      // so the authoritative aggregate version is 2 — updated from the
      // scaffold-era assumption that only the creation commits.
      const moved = await shell.updateArtifact({
        operationId: "artifact-revision-8",
        expectedAggregateVersion: 2,
        revision: 8,
        contentRef: "artifact-1/revisions/8",
      });
      expectApplied(moved, "artifact revision 8");

      const submitted = await shell.submit({
        eventId: "feedback-7",
        interactionId: activeView.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: activeView.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (submitted.kind !== "stale")
        throw new Error(`expected typed stale response, got ${submitted.kind}`);

      const view = shell.project();
      expect(view.feedback).toBeNull(); // feedback not accepted for revision 8

      const refreshed = await shell.refresh();
      if (refreshed.kind !== "refreshed")
        throw new Error(`expected refreshed snapshot, got ${refreshed.kind}`);
      expect(refreshed.projection.status).toBe("changed"); // refresh explains the changed work
      expect(refreshed.projection.taskRevision).toBe(8);
    });

    it("new-review — superseding review 7 binds review 8 to a new identity and revision while history stays inspectable", async () => {
      const store = new FakeReviewStore();
      const { shell, view } = await reachActiveReview(store);
      const review7Id = view.pendingReviews[0]?.reviewId;
      if (!review7Id)
        throw new Error("expected a pending review for revision 7");

      // complete review 7 so its history is inspectable, then supersede via revision 8
      const submitted = await shell.submit({
        eventId: "feedback-7",
        interactionId: view.interactionId,
        expectedTaskRevision: 7,
        expectedInteractionRevision: view.interactionRevision,
        feedback: FIRST_FEEDBACK,
      });
      if (submitted.kind !== "recorded")
        throw new Error(`expected recorded submission, got ${submitted.kind}`);
      // create + decision + recorded feedback = aggregate version 3 (see the
      // reachActiveReview note above).
      const moved = await shell.updateArtifact({
        operationId: "artifact-revision-8",
        expectedAggregateVersion: 3,
        revision: 8,
        contentRef: "artifact-1/revisions/8",
      });
      expectApplied(moved, "artifact revision 8");
      const decision8 = await shell.evaluateNeed({
        kind: "review_artifact",
        target: "artifact-1",
        taskRevision: 8,
        proposalId: "proposal-8",
        evidenceRefs: ["artifact-1/revisions/8"],
        evidenceStrength: "sufficient",
      });
      if (decision8.kind !== "decided")
        throw new Error(`expected decided evaluation, got ${decision8.kind}`);
      const committed8 = await shell.commitDecision({
        operationId: "create-review-8",
        decisionId: decision8.id,
      });
      if (committed8.kind !== "committed")
        throw new Error(`expected committed decision, got ${committed8.kind}`);

      const view8 = shell.project();
      const pending8 = view8.pendingReviews.filter((r) => r.revision === 8);
      expect(pending8).toHaveLength(1);
      const review8 = pending8[0];
      if (!review8)
        throw new Error("expected a pending review bound to revision 8");
      expect(review8.reviewId).not.toBe(review7Id); // new identity binding
      const history = [...view8.completedReviews, ...view8.pendingReviews];
      expect(history.some((r) => r.revision === 7)).toBe(true); // old history remains inspectable
    });

    it("unsupported-or-empty — unsupported kind and malformed need are typed refusals that create no active review", async () => {
      const store = new FakeReviewStore();
      const shell = await openReadyShell(store);
      const created = await shell.updateArtifact({
        operationId: "artifact-revision-7",
        expectedAggregateVersion: null,
        revision: 7,
        contentRef: "artifact-1/revisions/7",
      });
      expectApplied(created, "artifact creation");

      const unsupported = await shell.evaluateNeed({
        kind: "deploy_service",
        target: "artifact-1",
        taskRevision: 7,
        proposalId: "proposal-x",
        evidenceRefs: ["artifact-1/revisions/7"],
        evidenceStrength: "sufficient",
      });
      if (unsupported.kind !== "unsupported_kind") {
        throw new Error(`expected unsupported_kind, got ${unsupported.kind}`);
      }
      expect(unsupported.requestedKind).toBe("deploy_service");

      const malformed = await shell.evaluateNeed({
        kind: "review_artifact",
        target: "",
        taskRevision: 7,
        proposalId: "proposal-y",
        evidenceRefs: [],
        evidenceStrength: "sufficient",
      });
      if (malformed.kind !== "refused" && malformed.kind !== "no_candidate") {
        throw new Error(
          `expected typed refusal or no-candidate result, got ${malformed.kind}`,
        );
      }
      if (malformed.kind === "no_candidate") {
        expect(malformed.exclusions.length).toBeGreaterThan(0);
      }

      const view = shell.project();
      expect(view.pendingReviews).toHaveLength(0);
      expect(view.completedReviews).toHaveLength(0);
    });
  },
);

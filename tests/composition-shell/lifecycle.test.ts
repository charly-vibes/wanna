// Purpose: lifecycle contract for the composition shell (wanna-gcp)
// Responsibilities: explicit retirement, refresh-required retry refusal, uncertain-effect blocking and reconciliation, and the recorded surface compatibility decision through ONLY the public composition-shell barrel
// Rationale: openspec/changes/add-composition-shell/specs/composition-shell/spec.md scenarios retirement-only-on-explicit-command, retry-requires-refreshed-snapshot, acknowledgement-lost-after-durable-write and surface-change-ships-a-compatibility-decision
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as shellApi from "../../src/composition-shell";
import {
  CATALOG,
  FakeReviewStore,
  FIRST_FEEDBACK,
  KEY,
  expectApplied,
  openReadyShell,
  POLICY,
  reachActiveReview,
} from "./consumer-support";
import { recordingPort, submitCommand, updateCommand } from "./commit-helpers";

describe("composition-shell lifecycle (wanna-gcp)", () => {
  it("retirement-only-on-explicit-command — cancellation, expiry, supersession and retirement occur only through their explicit commands and never implicitly", async () => {
    const store = new FakeReviewStore();
    const { shell, view } = await reachActiveReview(store);
    expect(view.status).toBe("pending");

    // an authoritative revision change never retires the active review implicitly:
    // the interaction stays and the projection reports the changed work
    const moved = await shell.updateArtifact(
      updateCommand({ expectedAggregateVersion: 2 }),
    );
    expectApplied(moved, "artifact revision 8");
    const changedView = shell.project();
    expect(changedView.status).toBe("changed");
    expect(changedView.pendingReviews.some((r) => r.revision === 7)).toBe(true);

    // cancelling an unknown interaction is a typed stale refusal, no mutation
    const unknownCancel = await shell.cancel({
      operationId: "cancel-unknown",
      interactionId: "artifact-1:interaction:99",
    });
    expect(unknownCancel.kind).toBe("stale");

    // cancelling an already completed review is refused
    const submitted = await shell.submit({
      eventId: "feedback-8",
      interactionId: view.interactionId,
      expectedTaskRevision: 8,
      expectedInteractionRevision: view.interactionRevision,
      feedback: FIRST_FEEDBACK,
    });
    expect(submitted.kind).toBe("recorded");
    const completedCancel = await shell.cancel({
      operationId: "cancel-completed",
      interactionId: view.interactionId,
    });
    expect(completedCancel.kind).toBe("stale");

    // the explicit cancel command retires the displayed pending review
    const freshStore = new FakeReviewStore();
    const active = await reachActiveReview(freshStore);
    const retired = await active.shell.cancel({
      operationId: "cancel-review-7",
      interactionId: active.view.interactionId,
    });
    expect(retired.kind).toBe("retired");
    const retiredView = active.shell.project();
    expect(retiredView.status).toBe("retired");
    expect(
      retiredView.retiredReviews.some((r) => r.revision === 7),
    ).toBe(true);

    // retirement survives reconstruction as inspectable history
    const history = (await openReadyShell(freshStore)).project();
    expect(history.status).toBe("retired");
    expect(history.retiredReviews.some((r) => r.revision === 7)).toBe(true);
  });

  it("retry-requires-refreshed-snapshot — a retry after a cross-writer state-precondition rejection is refused before any port contact until a refreshed snapshot arrives", async () => {
    const store = new FakeReviewStore();
    await reachActiveReview(store);
    // the race loser runs on the recording port; the applier opens fresh after
    // the revision move so its own snapshot is current
    const { port, observed } = recordingPort(store.port(KEY));
    const loser = await openOnRecorded(port);

    // a caller-error stale (expectation contradicting the shell's own snapshot)
    // is not cross-writer evidence and does not demand a refresh
    const callerError = await loser.updateArtifact(
      updateCommand({ expectedAggregateVersion: 0 }),
    );
    expect(callerError.kind).toBe("stale");
    const moved = await loser.updateArtifact(
      updateCommand({ expectedAggregateVersion: 2, revision: 8 }),
    );
    expectApplied(moved, "artifact revision 8 after caller error");

    // the applier's snapshot is current: its feedback applies
    const applier = await openReadyShell(store);
    const recorded = await applier.submit(
      submitCommand({ eventId: "feedback-a", expectedTaskRevision: 8 }),
    );
    expect(recorded.kind).toBe("recorded");

    const lost = await loser.submit(
      submitCommand({ eventId: "feedback-b" }),
    );
    expect(lost.kind).toBe("stale");

    // the retry is refused WITHOUT contacting the port again — the caller must
    // refresh first, never re-commit against a possibly-stale snapshot
    const commitsBeforeRetry = observed.commits;
    const retried = await loser.submit(
      submitCommand({ eventId: "feedback-b-retry" }),
    );
    expect(retried.kind).toBe("stale");
    expect(observed.commits).toBe(commitsBeforeRetry);

    // refresh restores authority and clears the refusal
    const refreshed = await loser.refresh();
    if (refreshed.kind !== "refreshed")
      throw new Error(`expected refreshed snapshot, got ${refreshed.kind}`);
    expect(refreshed.projection.status).toBe("completed");

    // after refresh the shell accepts mutations against the fresh snapshot
    const unblocked = await loser.updateArtifact(
      updateCommand({
        operationId: "artifact-revision-9",
        expectedAggregateVersion: 4,
        revision: 9,
      }),
    );
    expectApplied(unblocked, "artifact revision 9 after refresh");
  });

  it("acknowledgement-lost-after-durable-write — an unknown commit effect blocks further mutation until reconciliation, and reconstruction never reapplies the committed response", async () => {
    const store = new FakeReviewStore();
    const { shell } = await reachActiveReview(store);

    store.loseNextAck(); // storage commits, acknowledgement is lost
    const lost = await shell.submit(
      submitCommand({}),
    );
    expect(lost.kind).toBe("unknown_effect");
    expect(store.rawState(KEY).receipts.get("feedback-7")?.applied).toBe(true);

    // mutation stays blocked until reconciliation — refused before port contact
    const fingerprintBefore = store.rawState(KEY).replay.length;
    const blocked = await shell.submit(
      submitCommand({ eventId: "feedback-8" }),
    );
    expect(blocked.kind).toBe("unknown_effect");
    expect(store.rawState(KEY).replay.length).toBe(fingerprintBefore);

    // a fresh authoritative snapshot alone does NOT unblock: reconciliation is required
    const refreshed = await shell.refresh();
    expect(refreshed.kind).toBe("refreshed");
    const stillBlocked = await shell.submit(
      submitCommand({ eventId: "feedback-8" }),
    );
    expect(stillBlocked.kind).toBe("unknown_effect");

    // reconciliation proves application and unblocks mutation; reconstruction
    // never reapplies the committed response
    const reconciled = await shell.reconcile("feedback-7");
    if (reconciled.kind !== "applied")
      throw new Error(`expected applied reconciliation, got ${reconciled.kind}`);
    const resumed = await openReadyShell(store);
    const replayed = await resumed.submit(
      submitCommand({}),
    );
    expect(replayed.kind).toBe("duplicate");
    expect(resumed.project().completedReviews).toHaveLength(1);

    // with uncertainty resolved the original shell accepts mutations again
    const unblocked = await shell.updateArtifact(
      updateCommand({ expectedAggregateVersion: 3 }),
    );
    expectApplied(unblocked, "artifact revision 8 after reconciliation");
  });

  it("reload-retains-evaluation-evidence — reopening from storage preserves proposal, evidence and evaluation versions separately from runtime versions, with empty evidence distinguishable", async () => {
    const store = new FakeReviewStore();
    const shell = await openReadyShell(store);
    const created = await shell.updateArtifact({
      operationId: "artifact-revision-7",
      expectedAggregateVersion: null,
      revision: 7,
      contentRef: "artifact-1/revisions/7",
    });
    expectApplied(created, "artifact creation");

    // empty evidence is distinguishable: it never decides — the eligibility
    // gate returns no_candidate instead of an evidence-less decision
    const withoutEvidence = await shell.evaluateNeed({
      kind: "review_artifact",
      target: "artifact-1",
      taskRevision: 7,
      proposalId: "proposal-empty-evidence",
      evidenceRefs: [],
      evidenceStrength: "sufficient",
    });
    expect(withoutEvidence.kind).toBe("no_candidate");

    const decided = await shell.evaluateNeed({
      kind: "review_artifact",
      target: "artifact-1",
      taskRevision: 7,
      proposalId: "proposal-7",
      evidenceRefs: ["artifact-1/revisions/7"],
      evidenceStrength: "sufficient",
    });
    if (decided.kind !== "decided")
      throw new Error(`expected decided evaluation, got ${decided.kind}`);
    const committed = await shell.commitDecision({
      operationId: "create-review-7",
      decisionId: decided.id,
    });
    expect(committed.kind).toBe("committed");
    const view = shell.project();
    const feedback = await shell.submit({
      eventId: "feedback-7",
      interactionId: view.interactionId,
      expectedTaskRevision: 7,
      expectedInteractionRevision: 1,
      feedback: FIRST_FEEDBACK,
    });
    expect(feedback.kind).toBe("recorded");

    // reopen from the same durable store: provenance is preserved per review
    const resumed = (await openReadyShell(store)).project();
    expect(resumed.completedReviews).toHaveLength(1);
    const preserved = resumed.completedReviews[0];
    if (!preserved) throw new Error("expected the committed review after reload");
    expect(preserved.revision).toBe(7);
    expect(preserved.provenance.proposalId).toBe("proposal-7");
    expect(preserved.provenance.evidenceRefs).toEqual([
      "artifact-1/revisions/7",
    ]);
    // exclusions round-trip exactly as the decision carried them
    expect(preserved.provenance.exclusions).toEqual(decided.provenance.exclusions);
    expect(preserved.provenance.exclusions.length).toBeGreaterThan(0);
    // evaluation versions are pinned separately from the runtime surface version
    expect(preserved.provenance.policyVersion).toBe(POLICY.policyVersion);
    expect(preserved.provenance.catalogVersion).toBe(CATALOG.catalogVersion);
    expect(preserved.provenance.shellVersion).toBe(
      shellApi.COMPOSITION_SHELL_VERSION,
    );
  });

  it("surface-change-ships-a-compatibility-decision — the 0.2.0 surface revision records its compatibility decision and migration note", () => {
    const record = readFileSync(
      join(
        import.meta.dirname,
        "..",
        "..",
        "openspec",
        "changes",
        "add-composition-shell",
        "compatibility.md",
      ),
      "utf8",
    );
    expect(shellApi.COMPOSITION_SHELL_VERSION).toBe("0.2.0");
    expect(record).toContain("0.1.0");
    expect(record).toContain("0.2.0");
    expect(record).toContain("additive");
    expect(record).toContain("Migration");
  });
});

/** Open a shell over an already-recording port (commit-helpers' openOn uses KEY constants). */
async function openOnRecorded(port: Parameters<typeof shellApi.openReviewSession>[0]["port"]) {
  const opened = await shellApi.openReviewSession({
    key: KEY,
    policy: { policyVersion: "policy-1" },
    catalog: { catalogVersion: "catalog-1" },
    port,
  });
  if (opened.kind !== "ready")
    throw new Error(`expected ready open, got ${opened.kind}`);
  return opened.shell;
}
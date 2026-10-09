// Purpose: shared consumer-owned support for the composition-shell consumer behavior contracts (wanna-9wu; guards retired by wanna-gcp)
// Responsibilities: in-memory fake durable store/port built purely from declared public port types, and the scenario harness helpers used by the split consumer suites
// Rationale: openspec/changes/add-composition-shell/consumer-example.md; extracted from the wanna-9wu consumer-behavior contract to satisfy pretender file/function limits without behavior change
// GUARD RETIREMENT (wanna-gcp): the transitional skip-guard probes and the
// consumer-side ExplicitCancelShell extension are removed — the shell surface
// now declares the explicit cancel command, implements reconcile, and blocks
// mutations after cross-writer stale rejections and unknown commit effects.
// Behavioral consumer suites run unconditionally.
//
// Test-port interpretation contract (consumer-owned):
// - The shell owns its `stateChanges` vocabulary (typed `unknown` at the public
//   surface). The fake port stores operations verbatim in the replay and applies
//   a shallow merge, tracking the authoritative task revision by the
//   `taskRevision` (fallback `revision`) field name. If the landed behavior
//   uses a different vocabulary, the owning ticket updates this fake
//   explicitly — this file IS the handoff contract.
// - `expectedVersion === null` means create-only (the aggregate must not exist
//   yet), matching consumer-example.md's initial compare-and-commit.
// - Fault controls (lost acknowledgement, incompatible storage) are injected at
//   the port boundary using only the declared port outcome types.
//
// Surface record: the explicit retire/cancel command landed with wanna-gcp
// ([[composition.shell.retire_only_explicit]]); the consumer suites assert
// through the declared `shell.cancel` command and `retiredReviews` projection
// field — no consumer-side extension type remains.
import * as shellApi from "../../src/composition-shell";
import type {
  ReviewProjection,
  ReviewSessionShell,
  SessionTaskKey,
} from "../../src/composition-shell";
import {
  FakePort,
  FakeReviewStore,
  KEY,
  POLICY,
  CATALOG,
  FIRST_FEEDBACK,
} from "./consumer-fakes";

export {
  FakeReviewStore,
  FakePort,
  KEY,
  POLICY,
  CATALOG,
  FIRST_FEEDBACK,
};

export async function openReadyShell(
  store: FakeReviewStore,
  key: SessionTaskKey = KEY,
): Promise<ReviewSessionShell> {
  const open = await shellApi.openReviewSession({
    key,
    policy: POLICY,
    catalog: CATALOG,
    port: store.port(key),
  });
  if (open.kind !== "ready")
    throw new Error(`expected ready open, got ${open.kind} (${open.reason})`);
  return open.shell;
}

export function expectApplied(
  outcome: { kind: string; aggregateVersion?: unknown },
  label: string,
): number {
  if (
    outcome.kind !== "applied" ||
    typeof outcome.aggregateVersion !== "number"
  ) {
    throw new Error(`expected applied ${label}, got ${outcome.kind}`);
  }
  return outcome.aggregateVersion;
}

/**
 * Drive the consumer example up to an active (pending) review for revision 7:
 * open → updateArtifact (create) → evaluateNeed → commitDecision.
 * Returns the shell and the projected view for subsequent assertions.
 */
export async function reachActiveReview(
  store: FakeReviewStore,
): Promise<{ shell: ReviewSessionShell; view: ReviewProjection }> {
  const shell = await openReadyShell(store);
  const created = await shell.updateArtifact({
    operationId: "artifact-revision-7",
    expectedAggregateVersion: null,
    revision: 7,
    contentRef: "artifact-1/revisions/7",
  });
  expectApplied(created, "artifact creation");
  const decision = await shell.evaluateNeed({
    kind: "review_artifact",
    target: "artifact-1",
    taskRevision: 7,
    proposalId: "proposal-7",
    evidenceRefs: ["artifact-1/revisions/7"],
    evidenceStrength: "sufficient",
  });
  if (decision.kind !== "decided") {
    throw new Error(`expected decided evaluation, got ${decision.kind}`);
  }
  const committed = await shell.commitDecision({
    operationId: "create-review-7",
    decisionId: decision.id,
  });
  if (committed.kind !== "committed") {
    throw new Error(`expected committed decision, got ${committed.kind}`);
  }
  const view = shell.project();
  return { shell, view };
}

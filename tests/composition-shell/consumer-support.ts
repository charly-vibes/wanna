// Purpose: shared consumer-owned support for the composition-shell consumer behavior contracts
// Responsibilities: in-memory fake durable store/port built purely from declared public port types, the behavior-landed probe, and the scenario harness helpers used by the split consumer suites
// Rationale: openspec/changes/add-composition-shell/consumer-example.md; extracted from the wanna-9wu consumer-behavior contract to satisfy pretender file/function limits without behavior change
// GUARD DESIGN (wanna-8k6, option b — split probes):
// Behavioral consumer tests are SKIP-GUARDED by one-time probes. Skipped-while-
// unimplemented is the DEFERRED-EVIDENCE state, never behavioral evidence. The
// probes flip as behavior lands and are REMOVED at wanna-gcp completion:
//
// - coreBehaviorLanded — true exactly when the full first path
//   (open → updateArtifact → evaluateNeed → commitDecision → submit → recorded)
//   works on a healthy fake port. Owned by wanna-0te + wanna-15e + wanna-8k6.
//   Enables the happy-path consumer tests: first-review, stale-decision,
//   stale-response, duplicate-delivery, restart, shared-writers,
//   unsupported-or-empty — plus new-review and incompatible-storage, which
//   pass incidentally through 8k6's revision-bound commits and the 0te open
//   path (wanna-gcp still owns supersession and recovery semantics).
//   Unit-level duplicate/conflict evidence lives in commit.test.ts; the
//   durable browser-level shared-store proof is separately required by
//   wanna-9r2.
// - reconcileBehaviorLanded — true when `reconcile` returns a typed outcome
//   instead of its stub error (wanna-gcp). Enables lost-acknowledgement,
//   which additionally needs mutation blocking between unknown_effect and
//   reconciliation ([[composition.shell.uncertain_effect_blocks_mutation]]).
// - cancelBehaviorLanded — true when the explicit cancel/retire command
//   exists on the shell surface (wanna-gcp). Enables cancel-after-display.
//
// Forcing a guard must produce ONLY missing-behavior failures — see
// .wai/projects/wanna/research/2026-10-10-9wu-red-evidence.md.
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
// Known surface gap recorded for the owning tickets: the scaffolded public
// surface does not yet declare the explicit retire/cancel command
// ([[composition.shell.retire_only_explicit]]). The cancel-after-display test
// asserts through the minimal consumer-visible extension `ExplicitCancelShell`
// below; wanna-gcp must align the consumer suites with the landed command shape.
import { describe } from "vitest";
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

function isNotImplementedStub(error: unknown): boolean {
  return error instanceof Error && error.message.startsWith("not implemented");
}

/**
 * One-time probe: has the full first path landed? True exactly when
 * open → updateArtifact → evaluateNeed → commitDecision → submit → recorded
 * works on a healthy fake port ([[composition.shell.review_completion_recorded]]);
 * stub errors or non-landed typed outcomes return false.
 */
async function openProbeShell(
  store: FakeReviewStore,
  key: SessionTaskKey,
): Promise<ReviewSessionShell | null> {
  const open = await shellApi.openReviewSession({
    key,
    policy: { policyVersion: "probe-policy" },
    catalog: { catalogVersion: "probe-catalog" },
    port: store.port(key),
  });
  if (open.kind !== "ready") return null;
  return open.shell;
}

/** Runs `probe`; a stub error means "not landed yet" (false); other errors propagate so the suite surfaces them. */
async function probeLanded(probe: () => Promise<boolean>): Promise<boolean> {
  try {
    return await probe();
  } catch (error) {
    if (isNotImplementedStub(error)) return false;
    throw error;
  }
}

function isDeclaredReconcileOutcome(outcome: { kind: string }): boolean {
  return (
    outcome.kind === "applied" ||
    outcome.kind === "not_applied" ||
    outcome.kind === "unknown_effect"
  );
}

async function probeFullFirstPath(): Promise<boolean> {
  return probeLanded(async () => {
    const key = { sessionId: "probe-session", taskId: "probe-task" };
    const shell = await openProbeShell(new FakeReviewStore(), key);
    if (!shell) return false;
    return probeArtifactUpdate(shell);
  });
}

async function probeArtifactUpdate(shell: ReviewSessionShell): Promise<boolean> {
  const applied = await shell.updateArtifact({
    operationId: "probe-update",
    expectedAggregateVersion: null,
    revision: 1,
    contentRef: "probe/revisions/1",
  });
  if (applied.kind !== "applied") return false;
  return probeDecisionAndSubmit(shell);
}

async function probeDecisionAndSubmit(
  shell: ReviewSessionShell,
): Promise<boolean> {
  const decision = await shell.evaluateNeed({
    kind: "review_artifact",
    target: "probe-task",
    taskRevision: 1,
    proposalId: "probe-proposal",
    evidenceRefs: ["probe/revisions/1"],
    evidenceStrength: "sufficient",
  });
  if (decision.kind !== "decided") return false;
  return probeCommitAndSubmit(shell, decision.id);
}

async function probeCommitAndSubmit(
  shell: ReviewSessionShell,
  decisionId: string,
): Promise<boolean> {
  const committed = await shell.commitDecision({
    operationId: "probe-decision",
    decisionId,
  });
  if (committed.kind !== "committed") return false;
  const view = shell.project();
  const submitted = await shell.submit({
    eventId: "probe-feedback",
    interactionId: view.interactionId,
    expectedTaskRevision: 1,
    expectedInteractionRevision: view.interactionRevision,
    feedback: "probe feedback",
  });
  return submitted.kind === "recorded";
}

async function probeReconcileLanded(): Promise<boolean> {
  return probeLanded(async () => {
    const key = { sessionId: "probe-session", taskId: "probe-task" };
    const shell = await openProbeShell(new FakeReviewStore(), key);
    if (!shell) return false;
    const outcome = await shell.reconcile("probe-operation");
    return isDeclaredReconcileOutcome(outcome);
  });
}

async function probeCancelLanded(): Promise<boolean> {
  return probeLanded(async () => {
    const key = { sessionId: "probe-session", taskId: "probe-task" };
    const shell = await openProbeShell(new FakeReviewStore(), key);
    if (!shell) return false;
    return (
      typeof (shell as unknown as Partial<ExplicitCancelShell>).cancel ===
      "function"
    );
  });
}

export const coreBehaviorLanded = await probeFullFirstPath();
export const reconcileBehaviorLanded = await probeReconcileLanded();
export const cancelBehaviorLanded = await probeCancelLanded();

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

/**
 * The scaffolded public surface does not yet declare the explicit retire/cancel
 * command ([[composition.shell.retire_only_explicit]]). wanna-gcp owns the
 * command shape; until it lands the consumer contract asserts through the
 * minimal consumer-visible extension below and MUST be aligned with the
 * landed surface.
 */
export type ExplicitCancelShell = ReviewSessionShell & {
  cancel(command: {
    readonly operationId: string;
    readonly interactionId: string;
  }): Promise<{ readonly kind: string; readonly reason?: string }>;
};

export const coreBehaviorSuite = describe.skipIf(!coreBehaviorLanded);

// Purpose: ready-shell session object for the composition shell (wanna-0te open slice)
// Responsibilities: hold the aggregate state loaded through the declared port without aliasing it, hand out derived immutable projections, and stub the commands owned by later tickets with precise owning-ticket errors
// Rationale: wanna-0te owns declared-port construction and load only; updateArtifact/commitDecision/submit semantics are wanna-8k6, evaluation is wanna-15e, reconcile/refresh are wanna-gcp
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md
import type {
  AggregateSnapshot,
  ReviewProjection,
  ReviewSessionShell,
} from "./types";

/**
 * Committed-state view held by an opened shell. Copied from the port snapshot
 * at the open boundary — never a reference into port storage — and mutated
 * only through declared port outcomes (wanna-8k6).
 */
export interface ShellState {
  readonly aggregateVersion: number;
  readonly taskRevision: number;
  readonly replay: readonly unknown[];
  readonly receipts: readonly unknown[];
}

/** State of a key that exists nowhere yet ([[composition.shell.commits_only_via_port]]). */
export function emptyShellState(): ShellState {
  return { aggregateVersion: 0, taskRevision: 0, replay: [], receipts: [] };
}

/** Copy a port snapshot into shell-owned state; no aliasing of port storage. */
export function shellStateFromSnapshot(snapshot: AggregateSnapshot): ShellState {
  return {
    aggregateVersion: snapshot.aggregateVersion,
    taskRevision: snapshot.taskRevision,
    replay: [...snapshot.replay],
    receipts: [...snapshot.receipts],
  };
}

/**
 * Open-slice projection: aggregate-derived fields only. Interaction semantics
 * (interactionId, review lists, statuses beyond an empty session) are owned by
 * wanna-8k6/wanna-gcp; `active` reports an open session with no recorded
 * interaction. Every call returns a fresh copy so mutating it can never reach
 * committed state ([[composition.shell.projection_derived_not_authoritative]]).
 */
export function projectState(state: ShellState): ReviewProjection {
  return {
    taskRevision: state.taskRevision,
    interactionId: "",
    interactionRevision: 0,
    status: "active",
    feedback: null,
    provenance: null,
    completedReviews: [],
    pendingReviews: [],
  };
}

/** Not-yet-landed command stub naming the owning ticket in the message. */
function stub(command: string, owner: string): never {
  throw new Error(`not implemented: ${owner} (${command})`);
}

/** Create the ready shell exposing the open-slice surface over `state`. */
export function createReviewSessionShell(state: ShellState): ReviewSessionShell {
  return {
    updateArtifact: async () => stub("updateArtifact", "wanna-8k6"),
    evaluateNeed: async () => stub("evaluateNeed", "wanna-15e"),
    commitDecision: async () => stub("commitDecision", "wanna-8k6"),
    project: () => projectState(state),
    submit: async () => stub("submit", "wanna-8k6"),
    reconcile: async () => stub("reconcile", "wanna-gcp"),
    refresh: async () => stub("refresh", "wanna-gcp"),
  };
}
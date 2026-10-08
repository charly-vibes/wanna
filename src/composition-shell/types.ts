// Purpose: vocabulary and record shapes for the composition shell public surface
// Responsibilities: typed discriminated outcomes for open, evaluate, commit, submit and reconcile; persistence port and projection types; no behavior
// Rationale: hosts consumer-example.md (openspec/changes/add-composition-shell) with host-neutral types only; behavior is owned by wanna-0te/15e/8k6/gcp
// Spec: openspec/changes/add-composition-shell/specs/composition-shell/spec.md

/** Semantic version of the shell's public surface ([[composition.shell.shell_surface_versioned]]). */
export const COMPOSITION_SHELL_VERSION = "0.1.0";

/** Trusted key binding a review session to one task of one session. */
export interface SessionTaskKey {
  readonly sessionId: string;
  readonly taskId: string;
}

/**
 * Trusted immutable evaluation policy input. The full policy shape is owned by
 * the interaction-policy capability; the shell only requires its version identity.
 */
export interface ReviewPolicy {
  readonly policyVersion: string;
}

/**
 * Trusted immutable interaction-catalog input. The full catalog shape is owned
 * by the interaction-catalog capability; the shell only requires its version identity.
 */
export interface ReviewCatalog {
  readonly catalogVersion: string;
}

/**
 * Consumer-declared persistence port ([[composition.shell.port_required_declared]]).
 * Operations mirror the wanna-d0h persistence contract; atomicity support is
 * declared, never assumed.
 */
export interface ReviewPersistencePort {
  readonly supportsAtomicCommitAndReplay: boolean;
  readonly deduplicationScope: ReadonlySet<string>;
  load(key: SessionTaskKey): Promise<PortLoadOutcome>;
  compareAndCommit(
    key: SessionTaskKey,
    expectedVersion: number | null,
    operation: PortOperation,
  ): Promise<PortCommitOutcome>;
  reconcile(key: SessionTaskKey, operationId: string): Promise<PortReconcileOutcome>;
}

/** Authoritative snapshot returned by the port; data must not alias mutable storage. */
export interface AggregateSnapshot {
  readonly aggregateVersion: number;
  readonly taskRevision: number;
  readonly replay: readonly unknown[];
  readonly receipts: readonly unknown[];
}

/** Operation handed to the port's conditional commit. */
export interface PortOperation {
  readonly operationId: string;
  readonly expectedTaskRevision: number | null;
  readonly expectedInteractionRevision: number | null;
  readonly stateChanges: unknown;
  readonly replayAdditions: readonly unknown[];
}

export type PortLoadOutcome =
  | { readonly kind: "loaded"; readonly snapshot: AggregateSnapshot }
  | { readonly kind: "not_found" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "recovery_required" };

export type PortCommitOutcome =
  | { readonly kind: "applied"; readonly receipt: PortReceipt; readonly snapshot: AggregateSnapshot }
  | { readonly kind: "duplicate"; readonly receipt: PortReceipt }
  | { readonly kind: "conflict" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "unknown_effect" };

export type PortReconcileOutcome =
  | { readonly kind: "applied"; readonly receipt: PortReceipt; readonly snapshot: AggregateSnapshot }
  | { readonly kind: "not_applied" }
  | { readonly kind: "unknown_effect" };

/** Stored proof that an operation was applied or certainly rejected. */
export interface PortReceipt {
  readonly operationId: string;
  readonly applied: boolean;
}

/** Input to [[openReviewSession]]; a missing port is a construction rejection. */
export interface OpenReviewSessionInput {
  readonly key: SessionTaskKey;
  readonly policy: ReviewPolicy;
  readonly catalog: ReviewCatalog;
  readonly port: ReviewPersistencePort;
}

/**
 * Outcome of opening a review session ([[composition.shell.continuity_restored]]):
 * `ready` unwraps to the shell; the other variants must be handled explicitly.
 */
export type OpenReviewSessionOutcome =
  | { readonly kind: "ready"; readonly shell: ReviewSessionShell }
  | { readonly kind: "unavailable"; readonly reason: string }
  | { readonly kind: "recovery_required"; readonly reason: string };

/** The per-session shell API returned by a `ready` open outcome. */
export interface ReviewSessionShell {
  updateArtifact(command: UpdateArtifactCommand): Promise<UpdateArtifactOutcome>;
  evaluateNeed(proposal: NeedProposalInput): Promise<EvaluateNeedOutcome>;
  commitDecision(command: CommitDecisionCommand): Promise<CommitDecisionOutcome>;
  project(): ReviewProjection;
  submit(event: SubmitEventCommand): Promise<SubmitOutcome>;
  reconcile(operationId: string): Promise<ReconcileOutcome>;
  refresh(): Promise<RefreshOutcome>;
}

/** Trusted artifact revision update; contents stay with the host via contentRef. */
export interface UpdateArtifactCommand {
  readonly operationId: string;
  readonly expectedAggregateVersion: number | null;
  readonly revision: number;
  readonly contentRef: string;
}

export type UpdateArtifactOutcome =
  | { readonly kind: "applied"; readonly aggregateVersion: number }
  | { readonly kind: "stale" }
  | { readonly kind: "duplicate"; readonly receipt: PortReceipt }
  | { readonly kind: "unavailable" }
  | { readonly kind: "unknown_effect" };

/** Raw need proposal accepted for normalization and evaluation; no caller-side bypass. */
export interface NeedProposalInput {
  readonly kind: string;
  readonly target: string;
  readonly taskRevision: number;
  readonly proposalId: string;
  readonly evidenceRefs: readonly string[];
  readonly evidenceStrength: string;
}

/** Immutable evaluated inputs bound by a decision id ([[composition.shell.evaluation_versions_pinned]]). */
export interface DecisionProvenance {
  readonly proposalId: string;
  readonly evidenceRefs: readonly string[];
  readonly exclusions: readonly string[];
  readonly normalizerIdentity: string;
  readonly policyVersion: string;
  readonly catalogVersion: string;
  readonly taxonomyVersion: string;
  readonly shellVersion: string;
}

/**
 * Decision outcomes: a decided result carries pinned versions and provenance;
 * refusals, no-candidate and unsupported mappings are typed and create no interaction.
 */
export type EvaluateNeedOutcome =
  | {
      readonly kind: "decided";
      readonly id: string;
      readonly taskRevision: number;
      readonly provenance: DecisionProvenance;
    }
  | { readonly kind: "no_candidate"; readonly exclusions: readonly string[] }
  | { readonly kind: "unsupported_kind"; readonly requestedKind: string }
  | { readonly kind: "refused"; readonly reason: string };

/** Initial decision commit; staleness is checked atomically with the commit. */
export interface CommitDecisionCommand {
  readonly operationId: string;
  readonly decisionId: string;
}

export type CommitDecisionOutcome =
  | { readonly kind: "committed"; readonly interactionId: string }
  | { readonly kind: "stale" }
  | { readonly kind: "duplicate"; readonly receipt: PortReceipt }
  | { readonly kind: "unavailable" }
  | { readonly kind: "unknown_effect" };

/** Derived observation of review state; mutating it cannot change committed state. */
export interface ReviewProjection {
  readonly taskRevision: number;
  readonly interactionId: string;
  readonly interactionRevision: number;
  readonly status: "active" | "completed" | "changed" | "pending" | "retired";
  readonly feedback: string | null;
  readonly provenance: DecisionProvenance | null;
  readonly completedReviews: readonly CompletedReview[];
  readonly pendingReviews: readonly PendingReview[];
}

export interface CompletedReview {
  readonly reviewId: string;
  readonly revision: number;
  readonly feedback: string;
  readonly provenance: DecisionProvenance;
}

export interface PendingReview {
  readonly reviewId: string;
  readonly revision: number;
}

/** Response submission validated against current revisions and dedup scope. */
export interface SubmitEventCommand {
  readonly eventId: string;
  readonly interactionId: string;
  readonly expectedTaskRevision: number;
  readonly expectedInteractionRevision: number;
  readonly feedback: string;
}

export type SubmitOutcome =
  | { readonly kind: "recorded" }
  | { readonly kind: "stale" }
  | { readonly kind: "duplicate"; readonly receipt: PortReceipt }
  | { readonly kind: "unavailable" }
  | { readonly kind: "unknown_effect" };

export type ReconcileOutcome =
  | { readonly kind: "applied"; readonly snapshot: AggregateSnapshot }
  | { readonly kind: "not_applied" }
  | { readonly kind: "unknown_effect" };

export type RefreshOutcome =
  | { readonly kind: "refreshed"; readonly projection: ReviewProjection }
  | { readonly kind: "unavailable" };
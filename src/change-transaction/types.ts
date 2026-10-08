// Purpose: vocabulary and record shapes for the change-transaction layer
// Responsibilities: states, transition ids, evidence bundles, candidate/revision records, interrupted operations, recovery policies
// Rationale: transactions move typed records through the revision ledger, never ad-hoc strings
import type { RevisionLedger } from "./revisions";

export type TransactionState =
  | "draft"
  | "previewed"
  | "validated"
  | "awaiting_approval"
  | "committed"
  | "rejected"
  | "conflicted"
  | "recovered";

export type TransitionId =
  | "preview_change"
  | "validate_change"
  | "request_approval"
  | "commit_change"
  | "reject_change"
  | "detect_revision_conflict"
  | "recover_interrupted_change";

export type GuardEvidenceKind = "validation" | "test" | "safety";

export interface CandidateEvidence {
  readonly validation?: readonly string[];
  readonly test?: readonly string[];
  readonly safety?: readonly string[];
}

export interface FullEvidence {
  readonly validation: readonly string[];
  readonly test: readonly string[];
  readonly safety: readonly string[];
  readonly approval: readonly string[];
}

export interface MigrationRecord {
  readonly migrationId: string;
  readonly migrationVersion: string;
  readonly tested: boolean;
}

export interface CandidateRevision {
  readonly id: string;
  readonly evidence?: CandidateEvidence;
  readonly migration?: MigrationRecord;
}

export type RevisionStatus = "accepted" | "rolled_back";

export interface RevisionRecord {
  readonly id: string;
  readonly parent: string | null;
  readonly restoredFrom: string | null;
  readonly evidence: FullEvidence | null;
  readonly migration: MigrationRecord | null;
  readonly status: RevisionStatus;
}

export type OperationStatus = "interrupted" | "marked";

export interface InterruptedOperation {
  readonly id: string;
  readonly effectId: string;
  readonly idempotent: boolean;
  status: OperationStatus;
}

export type RecoveryPolicy = { readonly kind: "mark_only" } | { readonly kind: "replay" };

export interface TransitionInput {
  readonly rebaseTo?: string;
  readonly approvalRefs?: readonly string[];
  readonly recoveryPolicy?: RecoveryPolicy;
}

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export interface TransactionInit {
  readonly id: string;
  readonly baseRevision: string | null;
  readonly ledger: RevisionLedger;
  readonly candidate: CandidateRevision | null;
}

export interface ChangeTransaction {
  readonly id: string;
  readonly state: TransactionState;
  readonly baseRevision: string | null;
  readonly candidate: CandidateRevision | null;
  readonly ledger: RevisionLedger;
  readonly lastTransition: TransitionId | null;
  readonly lastFailureReason: string | null;
  fire(id: TransitionId, input?: TransitionInput): TransitionResult;
  rollback(targetRevision: string): TransitionResult;
}

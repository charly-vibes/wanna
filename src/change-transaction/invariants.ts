// Purpose: invariants for the change-transaction layer
// Responsibilities: the eight spec constraints as guard checks, each returning a precise failure reason
// Rationale: every guard failure is nameable so negative tests can assert exact reasons
import type { RevisionLedger } from "./revisions";
import type {
  CandidateEvidence,
  CandidateRevision,
  GuardEvidenceKind,
  InterruptedOperation,
  MigrationRecord,
  RecoveryPolicy,
} from "./types";

export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

const REQUIRED_GUARD_EVIDENCE: readonly GuardEvidenceKind[] = ["validation", "test", "safety"];

export function missingEvidenceKinds(evidence: CandidateEvidence | undefined): readonly GuardEvidenceKind[] {
  return REQUIRED_GUARD_EVIDENCE.filter((kind) => (evidence?.[kind]?.length ?? 0) === 0);
}

export function baseRevisionPinned(baseRevision: string | null, ledger: RevisionLedger): Check {
  if (baseRevision === null || baseRevision.length === 0) {
    return { ok: false, reason: "base_revision_pinned does not hold: transaction has no pinned base revision" };
  }
  if (!ledger.isKnown(baseRevision)) {
    return {
      ok: false,
      reason: `base_revision_pinned does not hold: pinned base revision ${baseRevision} is not a known revision`,
    };
  }
  return { ok: true };
}

export function validationReportRetained(evidence: CandidateEvidence | undefined): Check {
  if ((evidence?.validation?.length ?? 0) === 0) {
    return { ok: false, reason: "validation_evidence_retained does not hold: candidate retains no validation evidence" };
  }
  return { ok: true };
}

export function committedEvidenceRetained(evidence: CandidateEvidence | undefined): Check {
  const missing = missingEvidenceKinds(evidence);
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `validation_evidence_retained does not hold: committed revision is missing evidence kind(s): ${missing.join(", ")}`,
    };
  }
  return { ok: true };
}

export function commitAtomic(candidate: CandidateRevision | null): Check {
  if (candidate === null || candidate.id.length === 0) {
    return { ok: false, reason: "commit_atomic does not hold: candidate revision has no durable identity" };
  }
  return { ok: true };
}

export function optimisticConflictChecked(
  baseRevision: string | null,
  activeRevision: string | null,
  rebaseTo: string | undefined,
  ledger: RevisionLedger,
): Check {
  if (activeRevision === baseRevision) return { ok: true };
  const conflict = `optimistic_conflict_checked does not hold: active revision ${activeRevision} does not match transaction base revision ${baseRevision}`;
  if (rebaseTo !== undefined) {
    if (ledger.isKnown(rebaseTo)) return { ok: true };
    return {
      ok: false,
      reason: `${conflict}; explicit rebase to ${rebaseTo} failed: rebase target is not a known revision`,
    };
  }
  return { ok: false, reason: `${conflict}; no explicit rebase provided` };
}

export function inflightOperationsNotReplayed(
  policy: RecoveryPolicy | undefined,
  operations: readonly InterruptedOperation[],
): Check {
  const effective: RecoveryPolicy = policy ?? { kind: "mark_only" };
  if (effective.kind !== "replay") return { ok: true };
  const nonIdempotent = operations.find((op) => op.status === "interrupted" && !op.idempotent);
  if (nonIdempotent) {
    return {
      ok: false,
      reason: `inflight_operations_not_replayed does not hold: recovery policy replay would re-run non-idempotent effect ${nonIdempotent.effectId}`,
    };
  }
  return { ok: true };
}

export function migrationExplicit(migration: MigrationRecord | undefined): Check {
  if (migration && (migration.migrationVersion.length === 0 || !migration.tested)) {
    return {
      ok: false,
      reason: `migration_explicit does not hold: migration ${migration.migrationId} is not versioned and tested`,
    };
  }
  return { ok: true };
}

export function rejectRequiresMissingEvidence(evidence: CandidateEvidence | undefined): Check {
  if (committedEvidenceRetained(evidence).ok) {
    return {
      ok: false,
      reason:
        "reject_change requires validation_evidence_retained to fail; candidate retains validation, test, and safety evidence",
    };
  }
  return { ok: true };
}

export function conflictRequiresOptimisticFailure(baseRevision: string | null, activeRevision: string | null): Check {
  if (activeRevision === baseRevision) {
    return {
      ok: false,
      reason:
        "detect_revision_conflict requires optimistic_conflict_checked to fail; active revision matches the transaction base revision",
    };
  }
  return { ok: true };
}

export function rollbackTargetValid(target: string, ledger: RevisionLedger): Check {
  const record = ledger.revision(target);
  if (record === null || record.status !== "accepted") {
    return { ok: false, reason: `rollback_is_new_revision does not hold: rollback target ${target} is not a known revision` };
  }
  return { ok: true };
}

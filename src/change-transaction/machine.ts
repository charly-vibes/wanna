// Purpose: change-transaction state machine
// Responsibilities: the seven spec transitions (preview, validate, request-approval, commit, reject, conflict, recover) with their guards, plus rollback
// Rationale: candidate construction and preview stay separate from durable activation — the active pointer moves only atomically
import type { RevisionLedger } from "./revisions";
import type {
  CandidateEvidence,
  CandidateRevision,
  ChangeTransaction,
  FullEvidence,
  TransitionId,
  TransitionInput,
  TransitionResult,
  TransactionInit,
  TransactionState,
} from "./types";
import {
  baseRevisionPinned,
  commitAtomic,
  conflictRequiresOptimisticFailure,
  inflightOperationsNotReplayed,
  migrationExplicit,
  optimisticConflictChecked,
  rejectRequiresMissingEvidence,
  rollbackTargetValid,
  committedEvidenceRetained,
  validationReportRetained,
} from "./invariants";
import type { Check } from "./invariants";

export const TRANSACTION_VERSION = "change-transaction@1.0.0";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: TransactionState;
  readonly to: TransactionState;
}

export const CHANGE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "preview_change", from: "draft", to: "previewed" },
  { id: "validate_change", from: "previewed", to: "validated" },
  { id: "request_approval", from: "validated", to: "awaiting_approval" },
  { id: "commit_change", from: "awaiting_approval", to: "committed" },
  { id: "reject_change", from: "validated", to: "rejected" },
  { id: "detect_revision_conflict", from: "awaiting_approval", to: "conflicted" },
  { id: "recover_interrupted_change", from: "conflicted", to: "recovered" },
];

interface Internals {
  transactionId: string;
  state: TransactionState;
  baseRevision: string | null;
  candidate: CandidateRevision | null;
  ledger: RevisionLedger;
  lastTransition: TransitionId | null;
  lastFailureReason: string | null;
  rollbacks: number;
}

function guardFor(internals: Internals, id: TransitionId, input?: TransitionInput): Check {
  const candidate = internals.candidate;
  switch (id) {
    case "preview_change":
      return baseRevisionPinned(internals.baseRevision, internals.ledger);
    case "validate_change":
      return validationReportRetained(candidate?.evidence);
    case "reject_change":
      return rejectRequiresMissingEvidence(candidate?.evidence);
    case "request_approval":
      return commitAtomic(candidate);
    case "commit_change":
      return optimisticConflictChecked(
        internals.baseRevision,
        internals.ledger.activeRevision,
        input?.rebaseTo,
        internals.ledger,
      );
    case "detect_revision_conflict":
      return conflictRequiresOptimisticFailure(internals.baseRevision, internals.ledger.activeRevision);
    case "recover_interrupted_change":
      return inflightOperationsNotReplayed(input?.recoveryPolicy, internals.ledger.interruptedOperations);
  }
}

function fullEvidence(cand: CandidateEvidence | undefined, approval: readonly string[]): FullEvidence {
  return {
    validation: [...(cand?.validation ?? [])],
    test: [...(cand?.test ?? [])],
    safety: [...(cand?.safety ?? [])],
    approval: [...approval],
  };
}

function commitCandidate(internals: Internals, input?: TransitionInput): TransitionResult {
  const approval = input?.approvalRefs ?? [];
  if (approval.length === 0) {
    return { ok: false, reason: "validation_evidence_retained does not hold: commit records no approval evidence" };
  }
  const evidence = committedEvidenceRetained(internals.candidate?.evidence);
  if (!evidence.ok) return evidence;
  const migration = migrationExplicit(internals.candidate?.migration);
  if (!migration.ok) return migration;
  const candidate = internals.candidate as CandidateRevision;
  const record = {
    id: candidate.id,
    parent: internals.ledger.activeRevision,
    restoredFrom: null,
    evidence: fullEvidence(candidate.evidence, approval),
    migration: candidate.migration ?? null,
    status: "accepted",
  } as const;
  if (!internals.ledger.appendRecord(record)) {
    return {
      ok: false,
      reason: "commit_atomic does not hold: durable revision record write failed; active pointer unchanged",
    };
  }
  internals.ledger.setActivePointer(record.id);
  internals.state = "committed";
  return { ok: true };
}

function rollbackRevision(internals: Internals, target: string): TransitionResult {
  const check = rollbackTargetValid(target, internals.ledger);
  if (!check.ok) return check;
  internals.rollbacks += 1;
  const record = {
    id: `rev-restored-${internals.rollbacks}`,
    parent: internals.ledger.activeRevision,
    restoredFrom: target,
    evidence: null,
    migration: null,
    status: "rolled_back",
  } as const;
  if (!internals.ledger.appendRecord(record)) {
    return {
      ok: false,
      reason: "commit_atomic does not hold: durable revision record write failed; active pointer unchanged",
    };
  }
  internals.ledger.setActivePointer(record.id);
  return { ok: true };
}

function applyEffect(internals: Internals, id: TransitionId, input?: TransitionInput): TransitionResult {
  if (id === "commit_change") return commitCandidate(internals, input);
  const to = CHANGE_TRANSITIONS.find((r) => r.id === id)!.to;
  if (id === "recover_interrupted_change") internals.ledger.markInterruptedOperations();
  internals.state = to;
  return { ok: true };
}

function fireTransition(internals: Internals, id: TransitionId, input?: TransitionInput): TransitionResult {
  const row = CHANGE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return { ok: false, reason: `unknown transition ${id}` };
  if (internals.state !== row.from) {
    return { ok: false, reason: `transition ${id} cannot fire from state ${internals.state}` };
  }
  const guard = guardFor(internals, id, input);
  if (!guard.ok) return guard;
  return applyEffect(internals, id, input);
}

function makeMachine(internals: Internals): ChangeTransaction {
  return {
    get id() {
      return internals.transactionId;
    },
    get state() {
      return internals.state;
    },
    get baseRevision() {
      return internals.baseRevision;
    },
    get candidate() {
      return internals.candidate;
    },
    get ledger() {
      return internals.ledger;
    },
    get lastTransition() {
      return internals.lastTransition;
    },
    get lastFailureReason() {
      return internals.lastFailureReason;
    },
    fire: (id, input) => {
      const result = fireTransition(internals, id, input);
      internals.lastTransition = id;
      internals.lastFailureReason = result.ok ? null : result.reason;
      return result;
    },
    rollback: (target) => rollbackRevision(internals, target),
  };
}

export function createChangeTransaction(init: TransactionInit): ChangeTransaction {
  const internals: Internals = {
    transactionId: init.id,
    state: "draft",
    baseRevision: init.baseRevision,
    candidate: init.candidate,
    ledger: init.ledger,
    lastTransition: null,
    lastFailureReason: null,
    rollbacks: 0,
  };
  return makeMachine(internals);
}

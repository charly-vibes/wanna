// Purpose: public surface of the change-transaction layer
// Responsibilities: re-export the machine, ledger, invariants, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { createChangeTransaction, CHANGE_TRANSITIONS, TRANSACTION_VERSION } from "./machine";
export type { TransitionRow } from "./machine";
export { createRevisionLedger } from "./revisions";
export type { LedgerInit, RevisionLedger } from "./revisions";
export {
  baseRevisionPinned,
  commitAtomic,
  conflictRequiresOptimisticFailure,
  inflightOperationsNotReplayed,
  migrationExplicit,
  missingEvidenceKinds,
  optimisticConflictChecked,
  rejectRequiresMissingEvidence,
  rollbackTargetValid,
  committedEvidenceRetained,
  validationReportRetained,
} from "./invariants";
export type { Check } from "./invariants";
export type {
  CandidateEvidence,
  CandidateRevision,
  ChangeTransaction,
  FullEvidence,
  GuardEvidenceKind,
  InterruptedOperation,
  MigrationRecord,
  OperationStatus,
  RecoveryPolicy,
  RevisionRecord,
  RevisionStatus,
  TransactionInit,
  TransactionState,
  TransitionId,
  TransitionInput,
  TransitionResult,
} from "./types";

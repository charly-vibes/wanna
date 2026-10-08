// Purpose: public surface of the recovery-contract layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createRecoveryMachine, RECOVERY_TRANSITIONS } from "./machine";
export type { RecoveryMachine, TransitionRow } from "./machine";
export {
  compensationIsNewEffect,
  evidencePreserved,
  executeRollback,
  postchecksDeclared,
  postchecksSatisfied,
  reconcilePrecedesUnknownRetry,
  recoveryOperationTyped,
  retryRequiresSafety,
  userControlAvailable,
} from "./invariants";
export { RECOVERY_OPERATIONS } from "./types";
export type {
  Check,
  CompensationRecord,
  RecoveryAttempt,
  RecoveryEvent,
  RecoveryOperation,
  RecoveryState,
  RollbackOutcome,
  TransitionId,
  TransitionResult,
  TypedFailure,
} from "./types";
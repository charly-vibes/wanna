// Purpose: vocabulary and record shapes for the recovery-contract layer
// Responsibilities: recovery operations, typed failures, attempts, states, transitions, evidence events, compensation records
// Rationale: recovery works on typed records — retry, resume, reconcile, restore, rollback, compensate,
//   restart, abort, escalate, and take_over have different semantics and must not be conflated
export const RECOVERY_OPERATIONS = [
  "retry", "resume", "reconcile", "restore", "rollback",
  "compensate", "restart", "abort", "escalate", "take_over",
] as const;

export type RecoveryOperation = (typeof RECOVERY_OPERATIONS)[number];

export interface TypedFailure {
  /** kind of the observed failure, e.g. "operation_failed" or "effect_unknown" */
  readonly failureKind: string;
  /** operation key of the failed operation the recovery targets */
  readonly operationKey: string;
  /** whether the failed operation mutates state (relevant to retry safety) */
  readonly mutating: boolean;
  /** evidence references for the original failure — recovery may append but never delete */
  readonly evidenceRefs: readonly string[];
}

export interface RecoveryAttempt {
  /** one supported recovery operation name; validated against RECOVERY_OPERATIONS */
  readonly operation?: string;
  /** operation key the recovery targets — must match the failure's key */
  readonly operationKey: string;
  /** the typed failure being recovered from */
  readonly failure: TypedFailure;
  /** declared precondition names, e.g. "idempotency_proven", "reconciliation_resolved" */
  readonly preconditions: readonly string[];
  /** declared post-recovery invariants that must be checked before `recovered` */
  readonly postcheckInvariants: readonly string[];
  /** whether recovery requires human judgment (user control must then be available) */
  readonly requiresHumanJudgment: boolean;
  /** alternatives exposed to the user, including safe abort and escalation */
  readonly alternatives?: readonly string[];
}

export type RecoveryState =
  | "proposed"
  | "eligible"
  | "executing"
  | "verifying"
  | "recovered"
  | "unresolved"
  | "blocked"
  | "escalated";

export type TransitionId =
  | "validate_recovery"
  | "block_unsafe_recovery"
  | "execute_recovery"
  | "verify_recovery"
  | "accept_recovery"
  | "preserve_failed_recovery"
  | "escalate_recovery";

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

export interface RecoveryEvent {
  /** strictly increasing lineage sequence number */
  readonly seq: number;
  readonly kind: string;
  readonly detail: string;
  readonly refs: readonly string[];
}

export interface CompensationRecord {
  /** authorization for the compensating action as a new effect */
  readonly authorizationRef: string;
  /** the compensating action is observable in the world */
  readonly observable: boolean;
  /** the compensating action declares its own failure path */
  readonly failurePathDeclared: boolean;
  /** audit references for the compensating action */
  readonly auditRefs: readonly string[];
  /** whether the compensating action succeeded when executed */
  readonly succeeded: boolean;
}

export interface RollbackOutcome {
  readonly ok: boolean;
  /** external effect ids that remain unresolved after the rollback */
  readonly residualEffects: readonly string[];
  /** internal rollback never claims to undo an external effect */
  readonly claimsExternalUndo: boolean;
  /** append-only lineage describing what the rollback did */
  readonly lineage: readonly string[];
}
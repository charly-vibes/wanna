// Purpose: test fixtures for the recovery-contract machine
// Responsibilities: build canonical valid attempts, typed failures, and compensation records
// Rationale: single source of shared recovery vocabulary for transitions and properties tests
import type {
  CompensationRecord,
  RecoveryAttempt,
  TypedFailure,
} from "../../src/recovery-contract/types";

export function typedFailure(overrides: Partial<TypedFailure> = {}): TypedFailure {
  return {
    failureKind: "operation_failed",
    operationKey: "op-1",
    mutating: false,
    evidenceRefs: ["ev-f1", "ev-f2"],
    ...overrides,
  };
}

export function validAttempt(overrides: Partial<RecoveryAttempt> = {}): RecoveryAttempt {
  return {
    operation: "retry",
    operationKey: "op-1",
    failure: typedFailure(),
    preconditions: ["same_operation_key", "failure_evidence_present"],
    postcheckInvariants: ["post: result matches authoritative state"],
    requiresHumanJudgment: false,
    ...overrides,
  };
}

export function validCompensation(
  overrides: Partial<CompensationRecord> = {},
): CompensationRecord {
  return {
    authorizationRef: "authz-c1",
    observable: true,
    failurePathDeclared: true,
    auditRefs: ["audit-c1"],
    succeeded: true,
    ...overrides,
  };
}
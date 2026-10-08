// Purpose: test fixtures for the failure model
// Responsibilities: build canonical typed failure records, assessments, and draft-bearing failures
// Rationale: single source of shared failure vocabulary for transitions and properties tests
import type {
  FailureAssessment,
  FailureRecord,
} from "../../src/failure-model/types";

export function typedFailureRecord(overrides: Partial<FailureRecord> = {}): FailureRecord {
  return {
    failureId: "failure-1",
    failureClass: "timeout",
    origin: "transport",
    scope: "task",
    severity: "high",
    affectedRevision: "task-9",
    evidence: ["ev-timeout-1"],
    mutating: true,
    provenance: {
      eventIds: ["event-1"],
      effectIds: ["effect-1"],
      toolIdentity: "tool/http-adapter",
      toolVersion: "1.2.0",
      timestamps: ["2026-01-01T00:00:00Z"],
      evidenceRefs: ["ev-timeout-1"],
    },
    ...overrides,
  };
}

export function assessment(overrides: Partial<FailureAssessment> = {}): FailureAssessment {
  return {
    effectCertainty: "effect_unknown",
    recoverability: "restart_only",
    retrySafety: "requires_reconciliation",
    ...overrides,
  };
}

export function draftFailure(overrides: Partial<FailureRecord> = {}): FailureRecord {
  return {
    failureId: "failure-draft",
    failureClass: "infrastructure_failure",
    origin: "infrastructure",
    scope: "session",
    severity: "medium",
    affectedRevision: "task-11",
    evidence: ["ev-infra-1"],
    mutating: false,
    userWork: {
      validatedInput: ["input-shipping-address"],
      drafts: ["draft-1", "draft-2"],
      auditHistory: ["audit-1", "audit-2", "audit-3"],
    },
    ...overrides,
  };
}

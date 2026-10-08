// Purpose: test fixtures for the human-authority layer
// Responsibilities: build canonical valid approval requests and authority grants, plus the invalid variants the corpus properties name
// Rationale: single source of shared authority vocabulary for transitions and properties tests
import type {
  ApprovalRequest,
  AuthorityGrant,
  VerificationClaim,
} from "../../src/human-authority/types";

export function validRequest(overrides: Partial<ApprovalRequest> = {}): ApprovalRequest {
  return {
    requestId: "req-1",
    principal: "user-1",
    action: "write:file",
    resourceScope: "repo:app",
    riskClass: "high",
    reviewedRevision: "rev-7",
    policyVersion: "policy-3",
    expiry: 200,
    invalidationConditions: ["revision-advances"],
    ...overrides,
  };
}

export function humanGrant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return {
    kind: "grant",
    source: "immediate_approval",
    grantedBy: "human",
    principal: "user-1",
    action: "write:file",
    resource: "repo:app",
    revision: "rev-7",
    policyVersion: "policy-3",
    ...overrides,
  };
}

export function automationGrant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return {
    kind: "grant",
    source: "bounded_automation_grant",
    grantedBy: "human",
    principal: "user-1",
    action: "write:file",
    resource: "repo:app",
    revision: "rev-7",
    policyVersion: "policy-3",
    maxUses: 3,
    usesRemaining: 3,
    ...overrides,
  };
}

export function verificationClaim(overrides: Partial<VerificationClaim> = {}): VerificationClaim {
  return {
    kind: "verification",
    basis: "authentication",
    principal: "user-1",
    ...overrides,
  };
}
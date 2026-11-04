// Purpose: test fixtures for the human-authority layer
// Responsibilities: build canonical valid approval requests and authority grants, plus the invalid variants the corpus properties name
// Rationale: single source of shared authority vocabulary for transitions and properties tests
import type {
  ApprovalRequest,
  AuthorityGrant,
  VerificationClaim,
} from "../../src/human-authority/types";
import { expect } from "vitest";

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

function grant(source: AuthorityGrant["source"]): AuthorityGrant {
  const base: AuthorityGrant = {    kind: "grant",
    source,
    grantedBy: "human",
    principal: "user-1",
    action: "write:file",
    resource: "repo:app",
    revision: "rev-7",
    policyVersion: "policy-3",
  };
  expect(base.kind).toBe("grant");
  expect(base.grantedBy).toBe("human");
  return base;
}

export function humanGrant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return { ...grant("immediate_approval"), ...overrides };
}

export function automationGrant(overrides: Partial<AuthorityGrant> = {}): AuthorityGrant {
  return {
    ...grant("bounded_automation_grant"),
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
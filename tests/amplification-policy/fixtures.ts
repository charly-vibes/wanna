// Purpose: test fixtures for the interaction amplification policy
// Responsibilities: build canonical contexts and candidates plus the violation variants the corpus properties name
// Rationale: single source of shared vocabulary for transitions and properties tests
import type {
  AmplificationCandidate,
  PolicyContext,
  RiskClass,
} from "../../src/amplification-policy/types";

export function context(overrides: Partial<PolicyContext> = {}): PolicyContext {
  return {
    taskRevision: "task-11",
    policyVersion: "amplification-policy-2026.10-provisional",
    catalogVersion: "catalog-2026.10-provisional",
    riskClass: "medium" as RiskClass,
    requiresHumanContribution: true,
    authorityGates: [],
    verificationGates: [],
    evidenceState: "sufficient",
    preferences: [],
    ...overrides,
  };
}

export function candidate(overrides: Partial<AmplificationCandidate> = {}): AmplificationCandidate {
  return {
    id: "cand-1",
    kind: "clarify",
    declaredHumanEffort: 3,
    declaredAssurance: 2,
    capabilities: [],
    ...overrides,
  };
}

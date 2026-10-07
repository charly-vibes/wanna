// Purpose: test fixtures for the contribution-primitives layer
// Responsibilities: build canonical valid proposals and the invalid/escape/retire variants the spec properties name
// Rationale: single source of shared primitive vocabulary for transitions and properties tests
import type {
  EscapeOutcome,
  PrimitiveKind,
  PrimitiveProposal,
} from "../../src/contribution-primitives/types";

export function validProposal(overrides: Partial<PrimitiveProposal> = {}): PrimitiveProposal {
  return {
    kind: "select",
    interactionId: "ixn-1",
    taskRevision: "task-7",
    provenance: ["ev-1", "ev-2"],
    ...overrides,
  };
}

export function proposalOfKind(kind: PrimitiveKind, overrides: Partial<PrimitiveProposal> = {}): PrimitiveProposal {
  return validProposal({ kind, ...overrides });
}

export function completedPayload(payload: unknown): { responsePayload: unknown } {
  return { responsePayload: payload };
}

export function escapeArg(outcome: EscapeOutcome): { escapeOutcome: EscapeOutcome } {
  return { escapeOutcome: outcome };
}

export function retireArg(taxonomyRevision: string): { taxonomyRevision: string } {
  return { taxonomyRevision: taxonomyRevision };
}
// Purpose: test fixtures for the interaction-need normalizer
// Responsibilities: build canonical valid proposals and the invalid variants the corpus properties name
// Rationale: single source of shared need vocabulary for transitions and properties tests
import type { NeedProposal } from "../../src/interaction-need/types";

export function validProposal(overrides: Partial<NeedProposal> = {}): NeedProposal {
  return {
    kind: "clarify_intent",
    target: "the assistant cannot proceed without knowing the intended output format",
    taskRevision: "task-7",
    proposalId: "need-prop-1",
    evidenceRefs: ["ev-1", "ev-2"],
    evidenceStrength: "sufficient",
    ...overrides,
  };
}

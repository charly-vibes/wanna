// Purpose: shared fixtures for interaction-engine conformance tests
// Responsibilities: canonical contexts, policies, candidates from the spec corpus
// Rationale: tests bind to [[spec]] predicates — malformed/pinned/deterministic shapes
import type {
  Candidate,
  ContextSnapshot,
  Policy,
} from "../../src/engine/index";

export function makeContext(overrides: Partial<ContextSnapshot> = {}): ContextSnapshot {
  return {
    taskId: "task-1",
    taskRevision: 3,
    need: "open the file panel",
    catalogVersion: "cat-2026.10.1",
    policyVersion: "pol-1",
    ...overrides,
  };
}

export function makePolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    version: "pol-1",
    candidates: [
      { id: "c2", priority: 1 },
      { id: "c1", priority: 2 },
      { id: "c3", priority: 1 },
    ],
    ...overrides,
  };
}

export const CANDIDATE_ORDER: readonly Candidate[] = [
  { id: "c1", priority: 2 },
  { id: "c2", priority: 1 },
  { id: "c3", priority: 1 },
];
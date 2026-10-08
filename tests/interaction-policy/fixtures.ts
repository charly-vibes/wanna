// Purpose: test fixtures for the interaction-policy evaluator
// Responsibilities: build canonical valid policy inputs, candidates, and the invalid variants the corpus properties name
// Rationale: single source of shared policy vocabulary for transitions and properties tests
import { POLICY_VERSION } from "../../src/interaction-policy/types";
import type { PolicyCandidate, PolicyInput } from "../../src/interaction-policy/types";

export const CATALOG_V7 = {
  version: "catalog-2026.10.7",
  supportedKinds: ["clarify", "choose", "rank", "review", "verify", "authorize"],
  needKindMappings: {
    clarify_intent: ["clarify", "choose", "rank"],
    review_artifact: ["review", "verify"],
    approve: ["authorize", "choose"],
  } as Readonly<Record<string, readonly string[]>>,
};

export const BASE_CONTEXT = { taskRevision: "task-11", userPreferences: ["compact"] };

export const BASE_NEED = {
  kind: "clarify_intent",
  target: "the assistant cannot proceed without knowing the intended output format",
  taskRevision: "task-11",
  proposalId: "need-prop-9",
  evidenceRefs: ["ev-1", "ev-2"],
  taxonomyVersion: "need-taxonomy-2026.10-provisional",
  normalizedBy: "interaction-need-normalizer@1.0.0",
} as const;

export function eligibleCandidate(overrides: Partial<PolicyCandidate> = {}): PolicyCandidate {
  return {
    id: "cand-1",
    kind: "clarify",
    requiredInputs: ["need_statement"],
    availableInputs: ["need_statement", "task_context"],
    requiredCapabilities: ["structured_prompting"],
    hostCapabilities: ["structured_prompting"],
    failedHardGates: [],
    score: 10,
    ...overrides,
  };
}

export function validInput(overrides: Partial<PolicyInput> = {}): PolicyInput {
  return {
    need: BASE_NEED,
    policyVersion: POLICY_VERSION,
    catalog: CATALOG_V7,
    maxRecommendations: 5,
    candidates: [
      eligibleCandidate(),
      eligibleCandidate({ id: "cand-2", kind: "choose", score: 8 }),
    ],
    context: BASE_CONTEXT,
    ...overrides,
  };
}
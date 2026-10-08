// Purpose: test fixtures for the interaction-patterns machine
// Responsibilities: build canonical pattern definitions and the degenerate variants the corpus properties name
// Rationale: single source of shared pattern vocabulary for transitions and properties tests
import type { PatternDefinition, PatternNode } from "../../src/interaction-patterns/types";

export const REGISTRY: readonly string[] = [
  "primitive.inspect",
  "primitive.evaluate",
  "primitive.verify",
  "primitive.annotate",
  "primitive.reject",
  "primitive.authorize",
  "primitive.clarify",
  "primitive.acquire_evidence",
  "primitive.propose_correction",
  "primitive.exit",
  "primitive.deliver",
];

export function node(overrides: Partial<PatternNode> = {}): PatternNode {
  return {
    id: "n1",
    primitiveId: "primitive.deliver",
    primitiveVersion: "1.0.0",
    ...overrides,
  };
}

export function genericPattern(overrides: Partial<PatternDefinition> = {}): PatternDefinition {
  return {
    patternId: "pattern.generic-1",
    kind: "generic",
    version: "1.0.0",
    nodes: [
      node({ id: "n1", primitiveId: "primitive.deliver" }),
      node({ id: "n2", primitiveId: "primitive.deliver" }),
    ],
    edges: [{ from: "n1", to: "n2" }],
    conditions: ["success", "failure"],
    successWhen: ["n2"],
    ...overrides,
  };
}

export function reviewPattern(overrides: Partial<PatternDefinition> = {}): PatternDefinition {
  return {
    patternId: "pattern.review-1",
    kind: "review",
    version: "2.0.0",
    nodes: [
      node({ id: "inspect", primitiveId: "primitive.inspect", judgmentKind: "inspection" }),
      node({ id: "evaluate", primitiveId: "primitive.evaluate", judgmentKind: "evaluation" }),
      node({ id: "verify", primitiveId: "primitive.verify", judgmentKind: "verification" }),
      node({ id: "annotate", primitiveId: "primitive.annotate", judgmentKind: "annotation" }),
      node({ id: "reject", primitiveId: "primitive.reject", judgmentKind: "rejection" }),
      node({ id: "authorize", primitiveId: "primitive.authorize", judgmentKind: "authorization" }),
    ],
    edges: [
      { from: "inspect", to: "evaluate" },
      { from: "evaluate", to: "verify" },
      { from: "verify", to: "annotate" },
      { from: "annotate", to: "reject" },
      { from: "reject", to: "authorize" },
    ],
    conditions: ["success", "failure", "rejection"],
    supportsRejection: true,
    successWhen: ["authorize"],
    ...overrides,
  };
}

export function diagnosisPattern(overrides: Partial<PatternDefinition> = {}): PatternDefinition {
  return {
    patternId: "pattern.diagnosis-1",
    kind: "diagnosis",
    version: "1.1.0",
    nodes: [
      node({ id: "d-inspect", primitiveId: "primitive.inspect", diagnosisPhase: "inspect" }),
      node({ id: "d-hypothesis", primitiveId: "primitive.evaluate", diagnosisPhase: "hypothesis" }),
      node({ id: "d-evidence", primitiveId: "primitive.acquire_evidence", diagnosisPhase: "evidence" }),
      node({ id: "d-correction", primitiveId: "primitive.propose_correction", diagnosisPhase: "correction" }),
      node({ id: "d-exit", primitiveId: "primitive.exit", diagnosisPhase: "exit" }),
    ],
    edges: [
      { from: "d-inspect", to: "d-hypothesis" },
      { from: "d-hypothesis", to: "d-evidence" },
      { from: "d-evidence", to: "d-correction" },
      { from: "d-correction", to: "d-exit" },
    ],
    conditions: ["success", "failure", "unresolved"],
    successWhen: ["d-exit"],
    maxIterations: 3,
    ...overrides,
  };
}

export function clarificationPattern(overrides: Partial<PatternDefinition> = {}): PatternDefinition {
  return {
    patternId: "pattern.clarification-1",
    kind: "clarification",
    version: "1.0.0",
    nodes: [
      node({ id: "ask", primitiveId: "primitive.clarify", unresolvedTarget: "the intended output format is ambiguous" }),
      node({ id: "apply", primitiveId: "primitive.deliver" }),
    ],
    edges: [{ from: "ask", to: "apply" }],
    conditions: ["success", "failure"],
    successWhen: ["apply"],
    ...overrides,
  };
}

export function degradedPattern(overrides: Partial<PatternDefinition> = {}): PatternDefinition {
  // a mid-run revision that no longer composes primitives and drops the
  // declared completion conditions — the only shape from which fail_pattern's
  // ¬(pattern_completion_explicit ∨ patterns_compose_primitives) guard holds
  return {
    patternId: "pattern.generic-1",
    kind: "generic",
    version: "0.9.0-degraded",
    nodes: [],
    edges: [],
    conditions: [],
    successWhen: [],
    ...overrides,
  };
}

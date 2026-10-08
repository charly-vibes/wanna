// Purpose: test fixtures for the capability-contract machine
// Responsibilities: build canonical valid capability contracts and compatibility decisions
// Rationale: single source of shared capability vocabulary for transitions and properties tests
import type {
  CapabilityContract,
  CompatibilityDecision,
  EffectDeclaration,
  EvaluationContract,
  PrePostconditions,
  SchemaDeclaration,
} from "../../src/capability-contract/types";

export function validIo(overrides: Partial<SchemaDeclaration> = {}): SchemaDeclaration {
  return {
    inputSchema: "Input: { query: string, limit?: number }",
    outputSchema: "Output: { results: string[], total: number }",
    validationRules: ["limit is a non-negative integer", "query is non-empty"],
    errorResultTypes: ["ValidationError", "TimeoutError"],
    ...overrides,
  };
}

export function validConditions(overrides: Partial<PrePostconditions> = {}): PrePostconditions {
  return {
    preconditions: ["the corpus is synced"],
    postconditions: ["the corpus is linted"],
    unmetConditionResult: "UnmetConditionError",
    ...overrides,
  };
}

export function validEffects(overrides: Partial<EffectDeclaration> = {}): EffectDeclaration {
  return {
    effects: ["writes derived artifacts"],
    resourceRequirements: ["read access to the corpus"],
    idempotency: "idempotent",
    reversibility: "compensatable",
    ...overrides,
  };
}

export function validEvaluation(overrides: Partial<EvaluationContract> = {}): EvaluationContract {
  return {
    goalChecks: ["the spec passes spk lint"],
    safetyInvariants: ["no partial deploy occurs"],
    goalCheckFailureBehavior: "retry once, then surface the failure",
    safetyCheckFailureBehavior: "halt immediately and report the violated invariant",
    ...overrides,
  };
}

export function validContract(overrides: Partial<CapabilityContract> = {}): CapabilityContract {
  return {
    identity: {
      capabilityId: "cap-spec-lint",
      semanticVersion: "1.2.0",
      provenance: "human:desk",
      revision: "rev-1",
    },
    io: validIo(),
    conditions: validConditions(),
    effects: validEffects(),
    evaluation: validEvaluation(),
    implementation: { kind: "code", reference: "src/caps/spec-lint.ts" },
    ...overrides,
  };
}

export function validCompatibility(overrides: Partial<CompatibilityDecision> = {}): CompatibilityDecision {
  return {
    decision: "breaking",
    migrationStrategy: "bump to 2.0.0 and provide a codemod for the input schema",
    ...overrides,
  };
}
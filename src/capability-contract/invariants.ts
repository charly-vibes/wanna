// Purpose: invariant checks for the capability-contract machine
// Responsibilities: the seven corpus constraints as precise-check functions with exact failure reasons
// Rationale: machine guards reuse the same checks at the trust boundary so negative tests can assert reasons verbatim
import type {
  CapabilityContract,
  CapabilityIdentity,
  Check,
  CompatibilityDecision,
  EffectDeclaration,
  EvaluationContract,
  PrePostconditions,
  SchemaDeclaration,
} from "./types";

interface Category {
  readonly field: string;
  readonly label: string;
}

export const IDENTITY_CATEGORIES: readonly Category[] = [
  { field: "capabilityId", label: "a stable ID" },
  { field: "semanticVersion", label: "a semantic version" },
  { field: "provenance", label: "an owner or provenance" },
  { field: "revision", label: "an immutable revision identifier" },
];

export const IO_CATEGORIES: readonly Category[] = [
  { field: "inputSchema", label: "an input schema" },
  { field: "outputSchema", label: "an output schema" },
  { field: "validationRules", label: "validation rules" },
  { field: "errorResultTypes", label: "error result types" },
];

export const CONDITION_CATEGORIES: readonly Category[] = [
  { field: "preconditions", label: "applicable preconditions" },
  { field: "postconditions", label: "postconditions" },
  { field: "unmetConditionResult", label: "a typed result for unmet conditions" },
];

export const EFFECT_CATEGORIES: readonly Category[] = [
  { field: "effects", label: "possible effects" },
  { field: "resourceRequirements", label: "resource requirements" },
  { field: "idempotency", label: "idempotency behavior" },
  { field: "reversibility", label: "whether effects are reversible or compensatable" },
];

export const EVALUATION_CATEGORIES: readonly Category[] = [
  { field: "goalChecks", label: "goal checks" },
  { field: "safetyInvariants", label: "safety invariants" },
  { field: "goalCheckFailureBehavior", label: "the behavior required when a goal check fails" },
  { field: "safetyCheckFailureBehavior", label: "the behavior required when a safety invariant fails" },
];

const OK: Check = { ok: true };
const SEMVER = /^\d+\.\d+\.\d+$/;

function fail(guardName: string, detail: string): Check {
  return { ok: false, reason: `guard ${guardName} does not hold: ${detail}` };
}

function missingLabels(record: unknown, categories: readonly Category[]): string[] {
  if (typeof record !== "object" || record === null) return categories.map((c) => c.label);
  const r = record as Record<string, unknown>;
  return categories
    .filter((c) => {
      const value = r[c.field];
      if (typeof value === "string") return value.length === 0;
      return !Array.isArray(value) || value.length === 0;
    })
    .map((c) => c.label);
}

function declaresGuard(
  guardName: string,
  noun: string,
  record: unknown,
  categories: readonly Category[],
): Check {
  const missing = missingLabels(record, categories);
  if (missing.length > 0) return fail(guardName, `${noun} does not declare ${missing.join(", ")}`);
  return OK;
}

export function capabilityIdentityVersioned(identity: CapabilityIdentity): Check {
  const missing = missingLabels(identity, IDENTITY_CATEGORIES);
  if (missing.length > 0) {
    return fail("capability_identity_versioned", `capability identity does not declare ${missing.join(", ")}`);
  }
  if (!SEMVER.test(identity.semanticVersion)) {
    return fail(
      "capability_identity_versioned",
      `capability identity declares "${identity.semanticVersion}" as the semantic version, which is not a semantic version`,
    );
  }
  return OK;
}

export function inputsOutputsTyped(io: SchemaDeclaration): Check {
  return declaresGuard("inputs_outputs_typed", "capability declaration", io, IO_CATEGORIES);
}

export function prePostconditionsDeclared(conditions: PrePostconditions): Check {
  return declaresGuard("pre_postconditions_declared", "capability declaration", conditions, CONDITION_CATEGORIES);
}

export function effectsDeclared(effects: EffectDeclaration): Check {
  return declaresGuard("effects_declared", "capability declaration", effects, EFFECT_CATEGORIES);
}

export function evaluationContractDeclared(evaluation: EvaluationContract): Check {
  return declaresGuard("evaluation_contract_declared", "capability declaration", evaluation, EVALUATION_CATEGORIES);
}

const NOT_CONTRACT = "guard implementation_not_contract does not hold: ";

export function implementationNotContract(contract: CapabilityContract): Check {
  const reference = contract.implementation.reference;
  const presented = [contract.io.inputSchema, contract.io.outputSchema].find((s) => s === reference);
  if (presented !== undefined) {
    return {
      ok: false,
      reason: `${NOT_CONTRACT}implementation source "${reference}" is presented as the public capability contract`,
    };
  }
  if (contract.implementation.kind === "provider-prompt" && undeclaredIo(contract)) {
    return {
      ok: false,
      reason: `${NOT_CONTRACT}a provider-specific prompt is the only declaration — implementation code or provider-specific prompts are not the public capability contract`,
    };
  }
  return OK;
}

function undeclaredIo(contract: CapabilityContract): boolean {
  return contract.io.inputSchema.length === 0 && contract.io.outputSchema.length === 0;
}

export function compatibilityExplicit(payload: CompatibilityDecision | undefined): Check {
  if (payload === undefined || payload === null) {
    return fail("compatibility_explicit", "no compatibility decision provided");
  }
  if (payload.decision.length === 0) {
    return fail("compatibility_explicit", "compatibility decision does not declare a compatibility decision");
  }
  if (payload.migrationStrategy.length === 0) {
    return fail("compatibility_explicit", "compatibility decision is not paired with a migration strategy");
  }
  return OK;
}
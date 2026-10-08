// Purpose: vocabulary and record shapes for the capability-contract layer
// Responsibilities: capability states, transition ids, identity/schema/pre-postcondition/effect/evaluation/compatibility declarations, and payload typing
// Rationale: capabilities are declared as typed contracts; implementation sources are carried but never authoritative
export type CapabilityState =
  | "proposed"
  | "validated"
  | "registered"
  | "deprecated"
  | "rejected";

export type CapabilityTransitionId =
  | "validate_capability"
  | "reject_capability"
  | "register_capability"
  | "deprecate_capability";

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type TransitionResult = Check;

export interface CapabilityIdentity {
  readonly capabilityId: string;
  readonly semanticVersion: string;
  readonly provenance: string;
  readonly revision: string;
}

export interface SchemaDeclaration {
  readonly inputSchema: string;
  readonly outputSchema: string;
  readonly validationRules: readonly string[];
  readonly errorResultTypes: readonly string[];
}

export interface PrePostconditions {
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
  readonly unmetConditionResult: string;
}

export interface EffectDeclaration {
  readonly effects: readonly string[];
  readonly resourceRequirements: readonly string[];
  readonly idempotency: string;
  readonly reversibility: string;
}

export interface EvaluationContract {
  readonly goalChecks: readonly string[];
  readonly safetyInvariants: readonly string[];
  readonly goalCheckFailureBehavior: string;
  readonly safetyCheckFailureBehavior: string;
}

export type ImplementationKind = "code" | "provider-prompt";

export interface ImplementationSource {
  readonly kind: ImplementationKind;
  readonly reference: string;
}

export interface CompatibilityDecision {
  readonly decision: string;
  readonly migrationStrategy: string;
}

export interface CapabilityContract {
  readonly identity: CapabilityIdentity;
  readonly io: SchemaDeclaration;
  readonly conditions: PrePostconditions;
  readonly effects: EffectDeclaration;
  readonly evaluation: EvaluationContract;
  readonly implementation: ImplementationSource;
}

export type TransitionPayloadMap = {
  validate_capability: undefined;
  reject_capability: undefined;
  register_capability: undefined;
  deprecate_capability: CompatibilityDecision;
};
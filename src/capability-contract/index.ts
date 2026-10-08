// Purpose: public surface of the capability-contract layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { CAPABILITY_TRANSITIONS, createCapabilityMachine } from "./machine";
export type { CapabilityMachine, TransitionRow } from "./machine";
export {
  capabilityIdentityVersioned,
  compatibilityExplicit,
  effectsDeclared,
  evaluationContractDeclared,
  implementationNotContract,
  inputsOutputsTyped,
  prePostconditionsDeclared,
  CONDITION_CATEGORIES,
  EFFECT_CATEGORIES,
  EVALUATION_CATEGORIES,
  IDENTITY_CATEGORIES,
  IO_CATEGORIES,
} from "./invariants";
export type {
  CapabilityContract,
  CapabilityIdentity,
  CapabilityState,
  CapabilityTransitionId,
  Check,
  CompatibilityDecision,
  EffectDeclaration,
  EvaluationContract,
  ImplementationKind,
  ImplementationSource,
  PrePostconditions,
  SchemaDeclaration,
  TransitionPayloadMap,
  TransitionResult,
} from "./types";
// Purpose: public surface of the interaction-contract layer
// Responsibilities: re-export the machine, types, invariants, and pinned registries under one entry point
// Rationale: callers import from the capability, never from internals
export { createContractMachine, CONTRACT_TRANSITIONS } from "./machine";
export type { ContractMachine, TransitionRow } from "./machine";
export {
  accessibilityObligationsCarried,
  acceptResponse,
  contractDeclaresContribution,
  contractHasBoundedContent,
  contractIdentityComplete,
  contractIsDataOnly,
  contractKindAllowlisted,
  contractPayloadValid,
  contractVersionSupported,
  correctedContractReceived,
  escapePathsDeclared,
  rejectionCodeFor,
  retirementRequested,
} from "./invariants";
export {
  CONTRACT_CONTENT_LIMITS,
  KIND_CONTRACT_SCHEMAS,
  PINNED_CONTRACT_KINDS,
  REGISTERED_CONTRACT_MIGRATIONS,
  SUPPORTED_CONTRACT_SCHEMA_VERSIONS,
  migrateInteractionContract,
  COMPOUND_ACTIVITIES,
  PRIMITIVE_KINDS,
} from "./registries";
export type { KindContractSchema } from "./registries";
export { CONTRACT_SCHEMA_VERSION } from "./types";
export type {
  AccessibilityObligations,
  Check,
  ContributionRef,
  ContractContentLimits,
  ContractResponse,
  ContractState,
  ContractTransitionId,
  EscapePaths,
  InteractionContract,
  MigrateResult,
  ResponseSchema,
  RetirementCommand,
  TransitionPayload,
  TransitionResult,
} from "./types";
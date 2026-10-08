// Purpose: public surface of the interaction-primitives layer
// Responsibilities: re-export the gate machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createPrimitiveSystemGate, PRIMITIVE_TRANSITIONS } from "./machine";
export type { PrimitiveSystemGate, TransitionRow } from "./machine";
export {
  EVIDENCE_CLASSES,
  GENERIC_AUTHORITY_SOURCES,
  SEMANTIC_LAYERS,
  ALLOWED_AUTHORITY_SOURCES,
  authorityOrthogonal,
  continuityNotPersistenceOnly,
  contributionPrecedesPresentation,
  contractsDeclarative,
  evidenceStrengthExplicit,
  failureAndRecoveryFirstClass,
  genericSignalCannotGrant,
  hostNeutralCore,
  semanticLayersSeparated,
} from "./invariants";
export type { Check, GenericAuthoritySource } from "./invariants";
export type {
  AuthorityGrant,
  AuthoritySource,
  ContinuityRecord,
  ContractDeclaration,
  ContractForm,
  ContractKind,
  EffectCertainty,
  EvidenceClass,
  FailurePath,
  InteractionSelection,
  LayerDeclaration,
  PrimitiveRevision,
  PrimitiveState,
  PrimitiveTransitionId,
  ProvenanceRecord,
  RecoveryAction,
  SemanticLayer,
  TransitionResult,
} from "./types";
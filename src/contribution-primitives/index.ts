// Purpose: public surface of the contribution-primitives layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createPrimitiveMachine, PRIMITIVE_TRANSITIONS, MACHINE_VERSION } from "./machine";
export type { PrimitiveMachine, TransitionRow } from "./machine";
export {
  COMPOUND_ACTIVITIES,
  ESCAPE_EFFECTS,
  ESCAPE_OUTCOMES,
  PRESENTATION_VOCABULARY,
  PRIMITIVE_KINDS,
  TAXONOMY_VERSION,
  NEED_TO_PRIMITIVES_POLICY,
  authorizeGuardSatisfied,
  defaultEscapeDeclaration,
  eligiblePrimitives,
  emitEvent,
  escapeSemanticsExplicit,
  interpretPrimitive,
  primitiveEventValid,
  primitiveNotPresentation,
  realize,
  rejectInvalidPrimitive,
  semanticallyAtomic,
  taxonomyVersionedRetirement,
} from "./invariants";
export type { AuthorityGrant, AuthorityState, Check, Host, Realization } from "./invariants";
export type {
  CompoundActivity,
  EscapeDeclaration,
  EscapeOutcome,
  EscapeRecord,
  PrimitiveDraft,
  PrimitiveEvent,
  PrimitiveKind,
  PrimitiveProposal,
  PrimitiveState,
  TransitionArg,
  TransitionId,
  TransitionResult,
} from "./types";
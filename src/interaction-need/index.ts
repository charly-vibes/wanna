// Purpose: public surface of the interaction-need layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createNeedNormalizer, NEED_TRANSITIONS, NORMALIZER_VERSION } from "./machine";
export type { NeedNormalizer, TransitionRow } from "./machine";
export {
  NEED_KINDS,
  TAXONOMY_VERSION,
  PRESENTATION_VOCABULARY,
  needNotPresentation,
  needSchemaValid,
  needTargetImmediate,
  unresolvedRequiresChange,
} from "./invariants";
export type { Check } from "./invariants";
export type {
  NeedKind,
  NeedProposal,
  NeedState,
  NormalizedNeed,
  TransitionId,
  TransitionResult,
  UnresolvedNeed,
  EvidenceStrength,
} from "./types";

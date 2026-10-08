// Purpose: public surface of the failure-model layer
// Responsibilities: re-export the machine, invariants, diagnostics, and types under one entry point
// Rationale: callers import from the capability, never from internals
export {
  createFailureModel,
  FAILURE_TRANSITIONS,
  FAILURE_MODEL_VERSION,
} from "./machine";
export type { FailureModelMachine, TransitionRow } from "./machine";
export {
  AI_FAILURE_CLASSES,
  EFFECT_CERTAINTY_VALUES,
  LOST_ACKNOWLEDGEMENT_CLASSES,
  RECOVERABILITY_CATEGORIES,
  effectCertaintyExplicit,
  failureIsTyped,
  knownClassifiable,
  recoverabilityExplicit,
  retryPathAllowed,
  retrySafetyHolds,
  uncertainClassifiable,
} from "./invariants";
export { renderFailureStatus } from "./diagnostics";
export type { FailureStatus } from "./diagnostics";
export type {
  AppliedTransition,
  Check,
  EffectCertainty,
  FailureAssessment,
  FailureClass,
  FailureOrigin,
  FailureProvenance,
  FailureRecord,
  FailureScope,
  FailureState,
  FireArg,
  PreservedUserWork,
  Recoverability,
  RetrySafety,
  SeverityCategory,
  TransitionId,
  TransitionResult,
} from "./types";

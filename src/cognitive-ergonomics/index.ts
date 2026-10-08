// Purpose: public surface of the cognitive-ergonomics layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createAdaptationMachine, ERGONOMICS_TRANSITIONS } from "./machine";
export type { AdaptationMachine, TransitionRow } from "./machine";
export {
  adaptationExplainableAndOverridable,
  adaptationTemporallyStable,
  authorityGuardSatisfied,
  choiceComplexityBounded,
  interruptionHasValueTest,
  measurableBurdenSeparated,
  recognitionPreferred,
  renderConfidence,
  stableActionIdentityHolds,
} from "./invariants";
export type {
  ActionIdentity,
  ActionPlacement,
  AdaptationDesign,
  AdaptationRequest,
  Check,
  ConfidenceSource,
  ErgonomicsState,
  ExposedChoice,
  GuardSubject,
  InferredState,
  InterruptionClaim,
  MeasurableTrigger,
  OptionSet,
  OverrideChannel,
  OverrideChannelKind,
  PresentationSpec,
  RevertRecord,
  TransitionId,
  TransitionResult,
} from "./types";

// Purpose: public surface of the interaction-runtime layer
// Responsibilities: re-export the machine, reducer, checks, projection, and types under one entry point
// Rationale: callers import from the capability, never from internals
export { createInteractionRuntime } from "./machine";
export type { InteractionRuntime, SubmitResult } from "./machine";
export { reduceEvent, replayLog, isLifecycle } from "./reducer";
export type { ReplayResult } from "./reducer";
export { envelopeValid } from "./envelope";
export { commitPreconditionsSatisfied } from "./preconditions";
export { projectRender } from "./projection";
export {
  CONTRACT_VERSION,
  SCHEMA_VERSION,
  POLICY_VERSION,
  EVENT_TYPES,
  INTERACTION_KINDS,
  OUTCOME_OF,
  LIFECYCLE_PERMISSIONS,
} from "./types";
export type {
  Check,
  CommitResult,
  CommittedState,
  ContinuityCheckpoint,
  EffectCertainty,
  EventEnvelope,
  InteractionEventType,
  InteractionKind,
  LifecycleEventType,
  LifecycleRecord,
  PersistencePort,
  Reduction,
  RenderProjection,
  ReplayRecord,
  ResponseRecord,
  RetiredOutcome,
  RuntimeFailure,
  RuntimeState,
  TransitionId,
  TransitionResult,
} from "./types";

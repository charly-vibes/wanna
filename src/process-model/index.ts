// Purpose: public surface of the process-model layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export { createProcessMachine, PROCESS_TRANSITIONS } from "./machine";
export type { ProcessMachine, TransitionRow } from "./machine";
export {
  compoundPatternValid,
  completionCriteriaExplicit,
  conditionsAllEvaluated,
  dependenciesAcyclicOrDeclared,
  failureRecoveryEdgesExplicit,
  processKindExplicit,
  resumeEventCorrelates,
  suspendRequiresCorrelation,
  transitionsGuarded,
  waitsCorrelated,
  cancellationSemanticsDefined,
} from "./invariants";
export type { Check } from "./invariants";
export {
  COMPOUND_ACTIVITIES,
  MODEL_KINDS,
  PROCESS_STATES,
  RECOVERY_EDGE_TYPES,
  SCHEMA_VERSION,
  TRANSITION_IDS,
} from "./types";
export type {
  BoundedLoop,
  CompoundActivity,
  CancellationSemantics,
  DependencyEdge,
  DependencyGraph,
  FailureEdges,
  FailureProvenance,
  FailureRecord,
  InteractionPattern,
  ModelKind,
  ProcessDefinition,
  ProcessState,
  RecoveryEdge,
  RecoveryEdgeType,
  TransitionId,
  TransitionRecord,
  TransitionResult,
  WaitRecord,
} from "./types";
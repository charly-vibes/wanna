// Purpose: public surface of the evaluation-telemetry layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export {
  createEvaluationPipeline,
  EVALUATION_TRANSITIONS,
} from "./machine";
export type { EvaluationPipeline, RecordedTransition, TransitionRow } from "./machine";
export {
  agreementNotCorrectness,
  metricsHaveDefinitions,
  metricsVersioned,
  privacyMinimized,
  promotionRequiresEvidence,
  regressionTriggersFallback,
  rollbackAllowed,
  shadowEffectsSuppressed,
} from "./invariants";
export { EVALUATOR_VERSION } from "./types";
export type {
  AgreementRecord,
  BreachedGuard,
  Check,
  DegradationSignal,
  EvaluationRecord,
  EvaluationState,
  EvaluationTransitionId,
  GateKind,
  GateResult,
  MetricDefinition,
  PolicyThreshold,
  RecoveryPolicy,
  TelemetryCollection,
  TelemetryMode,
  TransitionPayloadMap,
  TransitionResult,
} from "./types";
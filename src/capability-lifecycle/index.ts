// Purpose: public surface of the capability-lifecycle layer
// Responsibilities: re-export the machine, types, and invariants under one entry point
// Rationale: callers import from the capability, never from internals
export {
  createLifecycleMachine,
  LIFECYCLE_TRANSITIONS,
} from "./machine";
export type { LifecycleMachine, TransitionRow } from "./machine";
export {
  acceptanceRequiresGate,
  compositionIsBounded,
  failedCandidateNotActive,
  goalAndSafetySeparate,
  invokeIsExistingUse,
  previewIsNonCommitting,
  proposalInspectable,
  retirementAndRecoverySupported,
} from "./invariants";
export {
  DEVELOPMENT_POLICY,
  INVOKE_POLICY,
  REQUIRED_GATES,
  RISK_CLASSES,
} from "./types";
export type {
  AuditEntry,
  CapabilityComposition,
  CapabilityProposal,
  Check,
  CompositionStep,
  EvaluationPlan,
  GateOutcome,
  GateResult,
  InvokeRequest,
  LifecycleState,
  LifecycleTransitionId,
  PreviewContext,
  RiskClass,
  TransitionResult,
} from "./types";

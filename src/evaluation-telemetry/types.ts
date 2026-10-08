// Purpose: vocabulary and record shapes for the evaluation-telemetry layer
// Responsibilities: states, transitions, metric/gate/recovery/collection/agreement record types
// Rationale: evaluation measures quality and performance without confusing proxies with correctness
export const EVALUATOR_VERSION = "evaluation-telemetry-evaluator@1.0.0";

export type EvaluationState =
  | "collecting"
  | "evaluated"
  | "eligible"
  | "promoted"
  | "degraded"
  | "rolled_back";

export type EvaluationTransitionId =
  | "evaluate_candidate"
  | "mark_eligible"
  | "promote_candidate"
  | "detect_degradation"
  | "rollback_candidate";

export type TelemetryMode = "live" | "shadow";

export type GateKind = "quality" | "safety" | "cost" | "latency";

export type BreachedGuard = "quality" | "safety";

export interface MetricDefinition {
  readonly name: string;
  readonly unit: string;
  readonly population: string;
  readonly samplingMethod: string;
  readonly missingDataBehavior: string;
  readonly interpretationLimits: string;
}

export interface PolicyThreshold {
  readonly metric: string;
  readonly operator: "<=" | ">=" | "<" | ">";
  readonly value: number;
}

export interface GateResult {
  readonly kind: GateKind;
  readonly passed: boolean;
  readonly workloadRevision: string;
}

export interface TelemetryCollection {
  readonly mode: TelemetryMode;
  readonly purpose: string;
  readonly collectedFields: readonly string[];
  readonly accessControls: readonly string[];
  readonly retentionDays: number;
  readonly suppressesLiveEffects: boolean;
  readonly usesIsolatedTestDoubles: boolean;
}

export interface AgreementRecord {
  readonly incumbentImplementation: string;
  readonly candidateImplementation: string;
  readonly basis: "agreement_with_incumbent" | "independent_verification";
  readonly recordedAs: "agreement" | "correctness";
}

export interface RecoveryPolicy {
  readonly declared: boolean;
  readonly fallbackFor: readonly BreachedGuard[];
  readonly allowsRollback: boolean;
}

export interface DegradationSignal {
  readonly breachedGuard: BreachedGuard;
  readonly detectedBy: string;
}

export interface EvaluationRecord {
  readonly candidateImplementation: string;
  readonly incumbentImplementation: string;
  readonly workloadRevision: string;
  readonly evaluatorVersion: string;
  readonly policyThresholds: readonly PolicyThreshold[];
  readonly metrics: readonly MetricDefinition[];
  readonly gateResults: readonly GateResult[];
  readonly collection: TelemetryCollection;
  readonly recovery: RecoveryPolicy;
}

export type Check = { ok: true } | { ok: false; reason: string };

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export type TransitionPayloadMap = {
  evaluate_candidate: undefined;
  mark_eligible: undefined;
  promote_candidate: undefined;
  detect_degradation: DegradationSignal;
  rollback_candidate: undefined;
};
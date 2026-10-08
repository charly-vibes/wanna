// Purpose: test fixtures for the evaluation-telemetry layer
// Responsibilities: build canonical valid records and the violating variants the corpus properties name
// Rationale: single source of shared evaluation vocabulary for transitions and properties tests
import type {
  AgreementRecord,
  Check,
  DegradationSignal,
  EvaluationRecord,
  GateKind,
  GateResult,
  MetricDefinition,
  PolicyThreshold,
  RecoveryPolicy,
  TelemetryCollection,
  TransitionResult,
} from "../../src/evaluation-telemetry/types";

// narrows a failing TransitionResult/Check so tests can assert the exact reason type-safely
export function failureOf(result: TransitionResult | Check): string {
  if (result.ok) throw new Error("expected the transition or invariant to fail");
  return result.reason;
}

export const WORKLOAD = "wl-7";

export function validMetric(overrides: Partial<MetricDefinition> = {}): MetricDefinition {
  return {
    name: "correction_rate",
    unit: "ratio",
    population: "all completed interactions",
    samplingMethod: "uniform random 1-in-10",
    missingDataBehavior: "exclude from aggregate and report coverage",
    interpretationLimits: "not a correctness signal; proxy only",
    ...overrides,
  };
}

export function validCollection(overrides: Partial<TelemetryCollection> = {}): TelemetryCollection {
  return {
    mode: "live",
    purpose: "measure interaction quality for workload improvement",
    collectedFields: ["interaction_id", "latency_ms", "outcome_class"],
    accessControls: ["evaluator-role", "audit-role"],
    retentionDays: 90,
    suppressesLiveEffects: false,
    usesIsolatedTestDoubles: false,
    ...overrides,
  };
}

export function validThreshold(metric: string, value: number): PolicyThreshold {
  return { metric, operator: "<=", value };
}

export function validGate(kind: GateKind, overrides: Partial<GateResult> = {}): GateResult {
  return { kind, passed: true, workloadRevision: WORKLOAD, ...overrides };
}

export function allGatesPass(): readonly GateResult[] {
  return [
    validGate("quality"),
    validGate("safety"),
    validGate("cost"),
    validGate("latency"),
  ];
}

export function validRecovery(overrides: Partial<RecoveryPolicy> = {}): RecoveryPolicy {
  return {
    declared: true,
    fallbackFor: ["quality", "safety"],
    allowsRollback: true,
    ...overrides,
  };
}

export function validRecord(overrides: Partial<EvaluationRecord> = {}): EvaluationRecord {
  return {
    candidateImplementation: "impl-candidate@2.0.0",
    incumbentImplementation: "impl-incumbent@1.4.0",
    workloadRevision: WORKLOAD,
    evaluatorVersion: "evaluator@3.1.0",
    policyThresholds: [validThreshold("correction_rate", 0.05)],
    metrics: [validMetric()],
    gateResults: allGatesPass(),
    collection: validCollection(),
    recovery: validRecovery(),
    ...overrides,
  };
}

export function validAgreement(overrides: Partial<AgreementRecord> = {}): AgreementRecord {
  return {
    incumbentImplementation: "impl-incumbent@1.4.0",
    candidateImplementation: "impl-candidate@2.0.0",
    basis: "agreement_with_incumbent",
    recordedAs: "agreement",
    ...overrides,
  };
}

export function breach(kind: "quality" | "safety"): DegradationSignal {
  return { breachedGuard: kind, detectedBy: "evaluator@3.1.0" };
}
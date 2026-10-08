// Purpose: invariants for the evaluation-telemetry layer
// Responsibilities: the seven [[spec]] constraints as precise, individually failing checks
// Rationale: each invariant returns a precise failure reason so negative tests can assert it exactly
import type {
  AgreementRecord,
  BreachedGuard,
  Check,
  GateKind,
  MetricDefinition,
  RecoveryPolicy,
  TelemetryCollection,
} from "./types";
import type { EvaluationRecord } from "./types";

const OK: Check = { ok: true };

function fail(guardName: string, detail: string): Check {
  return { ok: false, reason: `guard ${guardName} does not hold: ${detail}` };
}

const METRIC_DIMENSIONS: readonly { field: keyof MetricDefinition; label: string }[] = [
  { field: "name", label: "name" },
  { field: "unit", label: "unit" },
  { field: "population", label: "population" },
  { field: "samplingMethod", label: "sampling method" },
  { field: "missingDataBehavior", label: "missing-data behavior" },
  { field: "interpretationLimits", label: "interpretation limits" },
];

const RAW_CONTENT_FIELDS: readonly string[] = [
  "raw_transcript", "full_prompt", "user_content", "conversation_log",
];

export function metricsHaveDefinitions(metrics: readonly MetricDefinition[]): Check {
  for (const metric of metrics) {
    const missing = METRIC_DIMENSIONS
      .filter((d) => metric[d.field].length === 0)
      .map((d) => d.label);
    if (missing.length > 0) {
      return fail("metrics_have_definitions", `metric "${metric.name}" does not declare ${missing.join(", ")}`);
    }
  }
  return OK;
}

const PRIVACY_REQUIREMENTS: readonly { label: string; holds: (c: TelemetryCollection) => boolean }[] = [
  { label: "a collection purpose", holds: (c) => c.purpose.length > 0 },
  { label: "access controls", holds: (c) => c.accessControls.length > 0 },
  { label: "configured retention", holds: (c) => c.retentionDays > 0 },
];

export function privacyMinimized(collection: TelemetryCollection): Check {
  const unmet = PRIVACY_REQUIREMENTS.filter((r) => !r.holds(collection)).map((r) => r.label);
  if (unmet.length > 0) {
    return fail("privacy_minimized", `telemetry collection does not declare ${unmet.join(", ")}`);
  }
  const raw = collection.collectedFields.filter((f) => RAW_CONTENT_FIELDS.includes(f));
  if (raw.length > 0) {
    return fail(
      "privacy_minimized",
      `telemetry collection collects raw-content fields beyond the declared purpose: ${raw.join(", ")}`,
    );
  }
  return OK;
}

export function agreementNotCorrectness(record: AgreementRecord): Check {
  if (record.basis === "agreement_with_incumbent" && record.recordedAs === "correctness") {
    return fail(
      "agreement_not_correctness",
      `agreement with incumbent "${record.incumbentImplementation}" is recorded as correctness ground truth`,
    );
  }
  return OK;
}

const GATE_ORDER: readonly GateKind[] = ["quality", "safety", "cost", "latency"];

export function promotionRequiresEvidence(record: EvaluationRecord): Check {
  for (const kind of GATE_ORDER) {
    const gate = record.gateResults.find((g) => g.kind === kind && g.workloadRevision === record.workloadRevision);
    if (!gate) {
      return fail(
        "promotion_requires_evidence",
        `no ${kind} gate result for workload "${record.workloadRevision}"`,
      );
    }
    if (!gate.passed) {
      return fail(
        "promotion_requires_evidence",
        `${kind} gate has not passed for workload "${record.workloadRevision}"`,
      );
    }
  }
  return OK;
}

export function shadowEffectsSuppressed(collection: TelemetryCollection): Check {
  if (collection.mode !== "shadow") return OK;
  const suppressed = collection.suppressesLiveEffects || collection.usesIsolatedTestDoubles;
  if (!suppressed) {
    return fail(
      "shadow_effects_suppressed",
      "shadow evaluation neither suppresses live effects nor uses isolated test doubles",
    );
  }
  return OK;
}

const RECORD_IDENTIFIERS: readonly { label: string; holds: (r: EvaluationRecord) => boolean }[] = [
  { label: "the candidate implementation", holds: (r) => r.candidateImplementation.length > 0 },
  { label: "the incumbent implementation", holds: (r) => r.incumbentImplementation.length > 0 },
  { label: "the dataset/workload revision", holds: (r) => r.workloadRevision.length > 0 },
  { label: "the evaluator version", holds: (r) => r.evaluatorVersion.length > 0 },
  { label: "the policy thresholds", holds: (r) => r.policyThresholds.length > 0 },
];

export function metricsVersioned(record: EvaluationRecord): Check {
  const missing = RECORD_IDENTIFIERS.filter((i) => !i.holds(record)).map((i) => i.label);
  if (missing.length > 0) {
    return fail("metrics_versioned", `evaluation record does not identify ${missing.join(", ")}`);
  }
  return OK;
}

export function regressionTriggersFallback(signal: { breachedGuard: BreachedGuard }, recovery: RecoveryPolicy): Check {
  if (!recovery.declared) {
    return fail(
      "regression_triggers_fallback",
      "no explicit recovery policy is declared for the promoted implementation",
    );
  }
  if (!recovery.fallbackFor.includes(signal.breachedGuard)) {
    return fail(
      "regression_triggers_fallback",
      `the recovery policy does not declare a fallback for the ${signal.breachedGuard} guard breach`,
    );
  }
  return OK;
}

export function rollbackAllowed(recovery: RecoveryPolicy): Check {
  if (!recovery.declared) {
    return fail(
      "regression_triggers_fallback",
      "no explicit recovery policy is declared for the promoted implementation",
    );
  }
  if (!recovery.allowsRollback) {
    return fail("regression_triggers_fallback", "the recovery policy does not permit rollback");
  }
  return OK;
}
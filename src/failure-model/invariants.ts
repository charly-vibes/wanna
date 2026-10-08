// Purpose: invariants and guard checks for the failure model
// Responsibilities: failure_is_typed, effect_certainty_explicit, recoverability_explicit, retry safety, retry-path admission
// Rationale: each invariant returns an exact failure reason so negative tests can assert it and bypasses cannot hide
import type {
  Check,
  EffectCertainty,
  FailureAssessment,
  FailureClass,
  FailureRecord,
  Recoverability,
} from "./types";

export const RECOVERABILITY_CATEGORIES: readonly Recoverability[] = [
  "automatic",
  "user_assisted",
  "operator_assisted",
  "compensatable",
  "restart_only",
  "unrecoverable_or_unknown",
];

export const EFFECT_CERTAINTY_VALUES: readonly EffectCertainty[] = [
  "no_effect",
  "effect_applied",
  "partial_effect",
  "effect_unknown",
];

/** AI-failure classes that must not mutate authoritative state merely because generation succeeded. */
export const AI_FAILURE_CLASSES: readonly FailureClass[] = [
  "malformed_ai_proposal",
  "invalid_plan",
  "tool_loop",
  "policy_violation",
  "untrusted_generated_code",
];

/** Failure classes where the acknowledgement was lost — effect certainty cannot be claimed as no_effect. */
export const LOST_ACKNOWLEDGEMENT_CLASSES: readonly FailureClass[] = ["timeout", "transport_failure"];

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

export function failureIsTyped(record: FailureRecord): Check {
  const required: ReadonlyArray<readonly [string, boolean]> = [
    ["failureClass", nonEmpty(record.failureClass)],
    ["origin", nonEmpty(record.origin)],
    ["scope", nonEmpty(record.scope)],
    ["severity", nonEmpty(record.severity)],
    ["affectedRevision", nonEmpty(record.affectedRevision)],
    ["observed evidence", Array.isArray(record.evidence) && record.evidence.length > 0],
  ];
  for (const [field, present] of required) {
    if (!present) return { ok: false, reason: `failure_is_typed does not hold: missing ${field}` };
  }
  return { ok: true };
}

export function effectCertaintyExplicit(record: FailureRecord, a: FailureAssessment): Check {
  if (!EFFECT_CERTAINTY_VALUES.includes(a.effectCertainty)) {
    return {
      ok: false,
      reason: "effect_certainty_explicit does not hold: the assessment must declare no_effect, effect_applied, partial_effect, or effect_unknown",
    };
  }
  const reconciled = Array.isArray(a.reconciliationEvidence) && a.reconciliationEvidence.length > 0;
  if (LOST_ACKNOWLEDGEMENT_CLASSES.includes(record.failureClass) && a.effectCertainty === "no_effect" && !reconciled) {
    return {
      ok: false,
      reason: "effect_certainty_explicit does not hold: timeout or transport failure alone cannot imply no_effect — the effect is effect_unknown until reconciliation supplies evidence",
    };
  }
  return { ok: true };
}

export function knownClassifiable(a: FailureAssessment): Check {
  if (a.effectCertainty === "effect_unknown") {
    return {
      ok: false,
      reason: "effect_certainty_explicit does not hold: an unknown outcome cannot be classified as a known failure",
    };
  }
  return { ok: true };
}

export function uncertainClassifiable(a: FailureAssessment): Check {
  if (a.effectCertainty !== "effect_unknown") {
    return {
      ok: false,
      reason: `effect_certainty_explicit does not hold: effect certainty ${a.effectCertainty} is known — classification belongs on the known path`,
    };
  }
  return { ok: true };
}

export function recoverabilityExplicit(a: FailureAssessment): Check {
  if (!RECOVERABILITY_CATEGORIES.includes(a.recoverability)) {
    return {
      ok: false,
      reason: "recoverability_explicit does not hold: recovery must be classified as automatic, user-assisted, operator-assisted, compensatable, restart-only, or unrecoverable/unknown",
    };
  }
  return { ok: true };
}

/** retry_safety_explicit holds when a mutating failure's retry is proven idempotent. */
export function retrySafetyHolds(record: FailureRecord, a: FailureAssessment): boolean {
  return !record.mutating || a.retrySafety === "proven_idempotent";
}

/** A retry path opens only when the effect state is known and retry is proven idempotent. */
export function retryPathAllowed(record: FailureRecord, a: FailureAssessment): Check {
  if (!record.mutating) return { ok: true };
  if (a.effectCertainty === "effect_unknown") {
    return {
      ok: false,
      reason: "the retry path is prohibited: the effect state is effect_unknown and retry is not proven safe until reconciliation supplies evidence",
    };
  }
  if (a.retrySafety !== "proven_idempotent") {
    return {
      ok: false,
      reason: `the retry path is prohibited: retry safety is ${a.retrySafety} — reconcile or compensate before retrying`,
    };
  }
  return { ok: true };
}

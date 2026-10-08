// Purpose: invariants for the cognitive-ergonomics layer
// Responsibilities: the eight spec constraints as checkable guards with precise failure reasons
// Rationale: each guard returns the exact reason it fails so negative tests assert bypasses, not vibes
import type {
  ActionIdentity,
  AdaptationDesign,
  AdaptationRequest,
  Check,
  ConfidenceSource,
  GuardSubject,
  InterruptionClaim,
  OptionSet,
  PresentationSpec,
} from "./types";

export type { Check } from "./types";

/** Options above this count, or any heterogeneous mix, count as a large option set. */
const LARGE_OPTION_SET = 12;

const INTERRUPTION_FIELDS: readonly { field: keyof InterruptionClaim; label: string }[] = [
  { field: "need", label: "unresolved need" },
  { field: "expectedBenefit", label: "expected benefit" },
  { field: "urgency", label: "urgency" },
  { field: "deferralRationale", label: "deferral rationale" },
];

export function measurableBurdenSeparated(request: AdaptationRequest): Check {
  const { measurableTriggers, inferredStates } = request.adaptation;
  if (measurableTriggers.length === 0) {
    return {
      ok: false,
      reason:
        "guard measurable_burden_separated_from_inference does not hold: no measurable burden recorded — inferred human state cannot trigger an adaptation alone",
    };
  }
  for (const inferred of inferredStates) {
    if (!inferred.uncertain) {
      return {
        ok: false,
        reason: `guard measurable_burden_separated_from_inference does not hold: inferred state ${inferred.attribute} is not labeled uncertain`,
      };
    }
  }
  return { ok: true };
}

export function adaptationTemporallyStable(adaptation: AdaptationDesign): Check {
  if (!adaptation.replacesSurfaceDuringEntry) return { ok: true };
  if (adaptation.safetyRequired || adaptation.userAccepted) return { ok: true };
  return {
    ok: false,
    reason:
      "guard adaptation_temporally_stable does not hold: the adaptation replaces or reorders the active response surface during entry without a safety requirement or explicit user acceptance",
  };
}

export function adaptationExplainableAndOverridable(adaptation: AdaptationDesign): Check {
  if (!adaptation.reason) {
    return {
      ok: false,
      reason: "guard adaptation_explainable_and_overridable does not hold: the material adaptation exposes no reason",
    };
  }
  if (!adaptation.override || !adaptation.override.available) {
    return {
      ok: false,
      reason:
        "guard adaptation_explainable_and_overridable does not hold: the adaptation exposes no way to revert, disable, or choose a stable presentation",
    };
  }
  return { ok: true };
}

export function interruptionHasValueTest(claim: InterruptionClaim): Check {
  for (const { field, label } of INTERRUPTION_FIELDS) {
    if (!claim[field]) {
      return { ok: false, reason: `interruption value test fails: no recorded ${label}` };
    }
  }
  return { ok: true };
}

export function authorityGuardSatisfied(subject: GuardSubject): Check {
  if (subject.kind === "inferred") {
    return {
      ok: false,
      reason: `inferred human state ${subject.attribute} cannot satisfy an authority guard — authority requires a measurable fact`,
    };
  }
  return { ok: true };
}

export function renderConfidence(value: number, source?: ConfidenceSource): Check {
  if (!source) {
    return {
      ok: false,
      reason:
        "uncertainty_not_fabricated violated: numeric confidence rendered without a source declaring metric and semantics",
    };
  }
  if (!source.metric) {
    return { ok: false, reason: "uncertainty_not_fabricated violated: confidence source declares no metric" };
  }
  if (!source.semantics) {
    return {
      ok: false,
      reason: `uncertainty_not_fabricated violated: confidence source declares metric ${source.metric} but no semantics`,
    };
  }
  if (source.evidenceRefs.length === 0) {
    return {
      ok: false,
      reason: `uncertainty_not_fabricated violated: confidence for ${source.metric} has no supporting evidence`,
    };
  }
  return { ok: true };
}

export function recognitionPreferred(spec: PresentationSpec): Check {
  if (spec.requiresRecallOf.length === 0) return { ok: true };
  if (!spec.equivalentExposeAvailable || !spec.feasible) return { ok: true };
  return {
    ok: false,
    reason: `recognition_preferred_when_equivalent violated: the presentation requires recall of ${spec.requiresRecallOf.join(", ")} while an equivalent, feasible exposure exists`,
  };
}

export function choiceComplexityBounded(set: OptionSet): Check {
  if (set.optionCount <= LARGE_OPTION_SET && !set.heterogeneous) return { ok: true };
  if (set.strategy && set.strategyDocumented) return { ok: true };
  return {
    ok: false,
    reason: `choice_complexity_bounded violated: surface ${set.surface} presents ${set.optionCount} ${set.heterogeneous ? "heterogeneous" : "homogeneous"} options as an unstructured exhaustive choice surface with no strategy`,
  };
}

export function stableActionIdentityHolds(identity: ActionIdentity): Check {
  if (!identity.frequentlyUsed && !identity.consequential) return { ok: true };
  for (const placement of identity.placements) {
    if (placement.semanticIdAtHost !== identity.semanticId) {
      return {
        ok: false,
        reason: `stable_action_identity violated: action ${identity.semanticId} appears as ${placement.semanticIdAtHost} on host ${placement.host}`,
      };
    }
  }
  return { ok: true };
}

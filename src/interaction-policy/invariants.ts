// Purpose: invariants and gates for the interaction-policy evaluator
// Responsibilities: input validation, the seven eligibility gates, deterministic ranking, result recording, authority refusal
// Rationale: every gate returns a precise stable reason code so exclusions are explainable and negative tests can assert them
import type {
  AuthorizationRequest,
  Check,
  ContextPin,
  ExcludedCandidate,
  NormalizedNeedRecord,
  PolicyCandidate,
  PolicyInput,
  PolicyResult,
  Recommendation,
} from "./types";
import {
  MAX_RECOMMENDATIONS_CEILING,
  POLICY_VERSION,
  TIE_BREAK_RULE_VERSION,
} from "./types";

export const REASON_CODES: readonly string[] = [
  "kind_unsupported",
  "catalog_constraint_violation",
  "required_input_missing",
  "host_capability_missing",
  "interruption_justification_insufficient",
  "mid_input_adaptation_blocked",
  "hard_gate_failed",
];

const INVALID = "policy_input_valid fails:";

function nonEmpty(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

function needRecordValid(need: NormalizedNeedRecord): Check {
  if (need === undefined || need === null) return { ok: false, reason: `${INVALID} missing normalized need record` };
  const required: readonly (readonly [unknown, string])[] = [
    [need.kind, "missing normalized need kind"],
    [need.target, "missing normalized need target"],
    [need.taskRevision, "missing normalized need task revision"],
    [need.proposalId, "missing normalized need proposal id"],
    [need.taxonomyVersion, "missing normalized need taxonomy version"],
    [need.normalizedBy, "missing normalized need normalizer provenance"],
  ];
  for (const [value, label] of required) {
    if (!nonEmpty(value)) return { ok: false, reason: `${INVALID} ${label}` };
  }
  if (!Array.isArray(need.evidenceRefs)) {
    return { ok: false, reason: `${INVALID} missing normalized need evidence references` };
  }
  return { ok: true };
}

function maximumValid(max: number): Check {
  const bounded = Number.isInteger(max) && max > 0 && max <= MAX_RECOMMENDATIONS_CEILING;
  if (!bounded) {
    return {
      ok: false,
      reason: `${INVALID} invalid maximum ${max}: must be a positive integer ≤ ${MAX_RECOMMENDATIONS_CEILING}`,
    };
  }
  return { ok: true };
}

function pinsValid(input: PolicyInput): Check {
  if (input.policyVersion !== POLICY_VERSION) {
    return { ok: false, reason: `${INVALID} unpinned policy version ${input.policyVersion} (expected ${POLICY_VERSION})` };
  }
  if (typeof input.catalog?.version !== "string" || input.catalog.version.length === 0) {
    return { ok: false, reason: `${INVALID} missing pinned catalog version` };
  }
  if (typeof input.context?.taskRevision !== "string" || input.context.taskRevision.length === 0) {
    return { ok: false, reason: `${INVALID} missing pinned context task revision` };
  }
  if (!Array.isArray(input.candidates)) return { ok: false, reason: `${INVALID} missing candidate set` };
  return { ok: true };
}

export function policyInputValid(input: PolicyInput): Check {
  const need = needRecordValid(input.need);
  if (!need.ok) return need;
  const max = maximumValid(input.maxRecommendations);
  if (!max.ok) return max;
  return pinsValid(input);
}

export function interruptionJustified(i: NonNullable<PolicyCandidate["interruption"]>): Check {
  if (i.targetUnresolved && i.expectedBenefit.length > 0 && i.urgencyRationale.length > 0 && i.urgencyRationale !== "deferred") {
    return { ok: true };
  }
  return {
    ok: false,
    reason:
      "interruption_justification_insufficient: a proactive interruption needs an unresolved target, expected benefit, and urgency/risk rationale — reason deferral is insufficient",
  };
}

export function adaptationStable(a: NonNullable<PolicyCandidate["adaptation"]>): Check {
  const disruptive = a.replacesActive && a.duringResponseEntry && !a.safetyRelated;
  if (!disruptive) return { ok: true };
  return {
    ok: false,
    reason: "mid_input_adaptation_blocked: non-safety adaptations may not replace or remap an active interaction during response entry",
  };
}

/** The seven hard eligibility gates, checked in declaration order; first failure wins. */
export function gateCandidate(candidate: PolicyCandidate, input: PolicyInput): Check {
  if (!input.catalog.supportedKinds.includes(candidate.kind)) return { ok: false, reason: "kind_unsupported" };
  const mapped = input.catalog.needKindMappings[input.need.kind] ?? [];
  if (!mapped.includes(candidate.kind)) return { ok: false, reason: "catalog_constraint_violation" };
  if (candidate.requiredInputs.some((r) => !candidate.availableInputs.includes(r))) {
    return { ok: false, reason: "required_input_missing" };
  }
  if (candidate.requiredCapabilities.some((c) => !candidate.hostCapabilities.includes(c))) {
    return { ok: false, reason: "host_capability_missing" };
  }
  for (const gate of candidate.failedHardGates) {
    return { ok: false, reason: `hard_gate_failed:${gate}` };
  }
  if (candidate.interruption !== undefined && !interruptionJustified(candidate.interruption).ok) {
    return { ok: false, reason: "interruption_justification_insufficient" };
  }
  if (candidate.adaptation !== undefined && !adaptationStable(candidate.adaptation).ok) {
    return { ok: false, reason: "mid_input_adaptation_blocked" };
  }
  return { ok: true };
}

export function countEligible(input: PolicyInput): number {
  return input.candidates.filter((c) => gateCandidate(c, input).ok).length;
}

export function exclusionsFor(input: PolicyInput): readonly ExcludedCandidate[] {
  return input.candidates
    .filter((c) => !gateCandidate(c, input).ok)
    .map((c) => ({ id: c.id, reasonCode: gateCandidate(c, input).reason! }));
}

/** Deterministic order: declared score descending, final stable tie-break key (candidate id) ascending. */
export function rankCandidates(input: PolicyInput): readonly Recommendation[] {
  return input.candidates
    .filter((c) => gateCandidate(c, input).ok)
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.id < b.id ? -1 : 1))
    .map((c) => ({ id: c.id, kind: c.kind, score: c.score, tieBreakKey: c.id }));
}

function burdenNames(
  candidate: PolicyCandidate,
  keep: (measurable: boolean, value: number) => boolean,
): readonly string[] {
  return (candidate.burdenAttributes ?? [])
    .filter((a) => keep(a.measurable, a.value))
    .map((a) => a.name);
}

function burdenMaps(recommendations: readonly Recommendation[], input: PolicyInput): {
  influence: Record<string, readonly string[]>;
  advisory: Record<string, readonly string[]>;
} {
  const influence: Record<string, readonly string[]> = {};
  const advisory: Record<string, readonly string[]> = {};
  for (const r of recommendations) {
    const candidate = input.candidates.find((c) => c.id === r.id);
    if (!candidate) continue;
    const infl = burdenNames(candidate, (measurable, value) => measurable && value !== 0);
    const adv = burdenNames(candidate, (measurable) => !measurable);
    if (infl.length > 0) influence[candidate.id] = infl;
    if (adv.length > 0) advisory[candidate.id] = adv;
  }
  return { influence, advisory };
}

export function buildResult(outcome: "recommended" | "no_candidate", input: PolicyInput): PolicyResult {
  const recommendations = rankCandidates(input);
  const { influence, advisory } = burdenMaps(recommendations, input);
  return {
    outcome,
    needIdentity: `${input.need.kind}:${input.need.proposalId}@${input.need.taskRevision}`,
    policyVersion: input.policyVersion,
    catalogVersion: input.catalog.version,
    tieBreakRuleVersion: TIE_BREAK_RULE_VERSION,
    rankingKeys: ["score", "id"],
    recommendations: outcome === "recommended" ? recommendations.slice(0, input.maxRecommendations) : [],
    exclusions: exclusionsFor(input),
    burdenInfluence: influence,
    burdenAdvisory: advisory,
  };
}

const UNCHANGED_CONTEXT =
  "guard new_context_received fails: supplied context is unchanged (task revision, catalog version, and user preferences are identical)";

function samePreferences(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().join("\u0000") === [...b].sort().join("\u0000");
}

export function contextChanged(pinned: ContextPin, next: ContextPin): Check {
  if (next.taskRevision === pinned.taskRevision
    && samePreferences(next.userPreferences, pinned.userPreferences)
    && (next.catalogVersion === undefined || next.catalogVersion === (pinned.catalogVersion ?? ""))) {
    return { ok: false, reason: UNCHANGED_CONTEXT };
  }
  return { ok: true };
}

export function authorizeWithRecommendation(
  _result: PolicyResult,
  _request: AuthorizationRequest,
): Check {
  void _result;
  void _request;
  return {
    ok: false,
    reason:
      "a policy recommendation carries no authority: authorization requires an independent permission or approval grant",
  };
}
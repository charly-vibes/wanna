// Purpose: candidate evaluation for the interaction amplification policy
// Responsibilities: apply the assurance floor and declared hard constraints, rank survivors by the pinned scoring policy
// Rationale: eligibility is decided before ranking; the ranked eligible list is the only thing least_burden_candidate may select from
import {
  RISK_CLASS_ASSURANCE_FLOOR,
  hardPreferencesUnmet,
  requiredReviewLevel,
  softAffinity,
} from "./invariants";
import { POLICY_VERSION, SCORING_POLICY_VERSION } from "./types";
import type {
  AmplificationCandidate,
  AmplificationDecision,
  DecisionEntry,
  PolicyContext,
} from "./types";

interface Evaluated {
  ok: boolean;
  reason?: string;
  decision?: AmplificationDecision;
}

function floorExclusion(ctx: PolicyContext, c: AmplificationCandidate): DecisionEntry | null {
  const floor = RISK_CLASS_ASSURANCE_FLOOR[ctx.riskClass];
  if ((c.declaredAssurance ?? -1) < floor) {
    return { id: c.id, reasonCode: "assurance_floor_unmet" };
  }
  return null;
}

function effortExclusion(c: AmplificationCandidate): DecisionEntry | null {
  if (typeof c.declaredHumanEffort !== "number") {
    return { id: c.id, reasonCode: "missing_declared_effort" };
  }
  return null;
}

function exclusionsFor(ctx: PolicyContext, candidates: readonly AmplificationCandidate[]): readonly DecisionEntry[] {
  const entries: DecisionEntry[] = [];
  for (const c of candidates) {
    const floor = floorExclusion(ctx, c);
    if (floor) entries.push(floor);
    const effort = effortExclusion(c);
    if (effort) entries.push(effort);
    const unmet = hardPreferencesUnmet(ctx.preferences, c.capabilities);
    if (unmet.length > 0) entries.push({ id: c.id, reasonCode: "hard_preference_unmet" });
  }
  return entries;
}

function rankEligible(ctx: PolicyContext, candidates: readonly AmplificationCandidate[]): readonly string[] {
  const excludedIds = new Set(exclusionsFor(ctx, candidates).map((e) => e.id));
  return candidates
    .filter((c) => !excludedIds.has(c.id))
    .sort((a, b) => {
      if (a.declaredHumanEffort !== b.declaredHumanEffort) {
        return (a.declaredHumanEffort ?? 0) - (b.declaredHumanEffort ?? 0);
      }
      const affinity = softAffinity(ctx.preferences, b) - softAffinity(ctx.preferences, a);
      return affinity !== 0 ? affinity : a.id.localeCompare(b.id);
    })
    .map((c) => c.id);
}

export function evaluateCandidates(
  ctx: PolicyContext,
  candidates: readonly AmplificationCandidate[],
  contextDigest: string,
): Evaluated {
  for (const c of candidates) {
    if (c.declaredAssurance === undefined) {
      return {
        ok: false,
        reason: `guard risk_floor_preserved fails: candidate ${c.id} does not declare an assurance level`,
      };
    }
  }
  const decision: AmplificationDecision = {
    outcome: "unevaluated",
    contextDigest,
    policyVersion: POLICY_VERSION,
    catalogVersion: ctx.catalogVersion,
    scoringPolicyVersion: SCORING_POLICY_VERSION,
    reviewLevel: requiredReviewLevel(ctx.riskClass, ctx.evidenceState),
    eligible: rankEligible(ctx, candidates),
    selected: [],
    exclusions: exclusionsFor(ctx, candidates),
  };
  return { ok: true, decision };
}

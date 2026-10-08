// Purpose: invariants for the interaction amplification policy
// Responsibilities: assurance floors, review-level baselines and escalation, reason-code vocabulary, deterministic context digests
// Rationale: each invariant is a pure function with a precise failure reason so negative tests can assert it exactly
import type {
  AmplificationCandidate,
  EvidenceState,
  PolicyContext,
  ReasonCode,
  ReviewLevel,
  RiskClass,
  UserPreference,
} from "./types";

export const REASON_CODES: readonly ReasonCode[] = [
  "selected_least_burden",
  "assurance_floor_unmet",
  "missing_declared_effort",
  "hard_preference_unmet",
];

export const RISK_CLASS_ASSURANCE_FLOOR: Record<RiskClass, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

export const RISK_CLASS_REVIEW_BASELINE: Record<RiskClass, ReviewLevel> = {
  low: "none",
  medium: "self",
  high: "peer",
  critical: "independent",
};

export const REVIEW_LEVEL_ORDER: readonly ReviewLevel[] = [
  "none",
  "self",
  "peer",
  "independent",
];

const EVIDENCE_ESCALATION: Record<EvidenceState, ReviewLevel> = {
  sufficient: "none",
  uncertain: "self",
  ambiguous: "peer",
  conflicting: "independent",
};

function levelIndex(level: ReviewLevel): number {
  return REVIEW_LEVEL_ORDER.indexOf(level);
}

export function evidenceEscalation(evidenceState: EvidenceState): ReviewLevel {
  return EVIDENCE_ESCALATION[evidenceState];
}

export function requiredReviewLevel(riskClass: RiskClass, evidenceState: EvidenceState): ReviewLevel {
  const baseline = RISK_CLASS_REVIEW_BASELINE[riskClass];
  const escalated = EVIDENCE_ESCALATION[evidenceState];
  return levelIndex(escalated) > levelIndex(baseline) ? escalated : baseline;
}

export function isSoftPreference(preference: UserPreference): boolean {
  return preference.kind === "presentation";
}

export function hardPreferencesUnmet(
  preferences: readonly UserPreference[],
  capabilities: readonly string[],
): readonly UserPreference[] {
  return preferences.filter(
    (p) => !isSoftPreference(p) && !capabilities.includes(p.capability),
  );
}

export function softAffinity(
  preferences: readonly UserPreference[],
  candidate: AmplificationCandidate,
): number {
  return preferences.filter(
    (p) => isSoftPreference(p) && candidate.capabilities.includes(p.capability),
  ).length;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value instanceof Object) {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, stableValue(v)]));
  }
  return value;
}

function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function contextDigest(ctx: PolicyContext): string {
  return fnv1a(JSON.stringify(stableValue(ctx)));
}

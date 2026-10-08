// Purpose: vocabulary and record shapes for the interaction amplification policy
// Responsibilities: risk classes, review levels, preference kinds, candidate/context records, state and transition types
// Rationale: the policy is deterministic after normalization — every gate input must be a typed record, never presentation-shaped data
export const POLICY_VERSION = "amplification-policy-2026.10-provisional";
export const SCORING_POLICY_VERSION = "least-declared-effort-asc-id-asc@1";

export type RiskClass = "low" | "medium" | "high" | "critical";
export type EvidenceState = "sufficient" | "uncertain" | "ambiguous" | "conflicting";
export type ReviewLevel = "none" | "self" | "peer" | "independent";
export type PreferenceKind = "presentation" | "accessibility" | "safety" | "task";

export interface UserPreference {
  readonly kind: PreferenceKind;
  readonly capability: string;
}

export interface AmplificationCandidate {
  readonly id: string;
  readonly kind: string;
  readonly declaredHumanEffort?: number;
  readonly declaredAssurance?: number;
  readonly capabilities: readonly string[];
}

export interface PolicyContext {
  readonly taskRevision: string;
  readonly policyVersion: string;
  readonly catalogVersion: string;
  readonly riskClass: RiskClass;
  readonly requiresHumanContribution: boolean;
  readonly authorityGates: readonly string[];
  readonly verificationGates: readonly string[];
  readonly evidenceState: EvidenceState;
  readonly preferences: readonly UserPreference[];
}

export interface NormalizedContext {
  readonly taskRevision: string;
  readonly policyVersion: string;
  readonly catalogVersion: string;
  readonly riskClass: RiskClass;
  readonly evidenceState: EvidenceState;
  readonly digest: string;
}

export type ReasonCode =
  | "selected_least_burden"
  | "assurance_floor_unmet"
  | "missing_declared_effort"
  | "hard_preference_unmet";

export interface DecisionEntry {
  readonly id: string;
  readonly reasonCode: ReasonCode;
}

export interface AmplificationDecision {
  readonly outcome: "unevaluated" | "selected" | "no_candidate";
  readonly contextDigest: string;
  readonly policyVersion: string;
  readonly catalogVersion: string;
  readonly scoringPolicyVersion: string;
  readonly reviewLevel: ReviewLevel;
  readonly eligible: readonly string[];
  readonly selected: readonly DecisionEntry[];
  readonly exclusions: readonly DecisionEntry[];
}

export type AmplificationState =
  | "received"
  | "normalized"
  | "evaluated"
  | "selected"
  | "no_candidate"
  | "stale";

export type TransitionId =
  | "normalize_context"
  | "evaluate_candidates"
  | "select_candidate"
  | "return_no_candidate"
  | "reject_stale_context"
  | "recompute_new_context";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

// Purpose: vocabulary and record shapes for the interaction-policy layer
// Responsibilities: pinned versions, policy input/result records, states, transition ids, candidate vocabulary
// Rationale: the policy works on typed records — semantic contribution kinds, never host widget shapes
export const POLICY_VERSION = "interaction-policy-2026.10-provisional";

export const TIE_BREAK_RULE_VERSION = "stable-score-desc-id-asc@1";

export const MAX_RECOMMENDATIONS_CEILING = 64;

export type PolicyState =
  | "ready"
  | "evaluating"
  | "recommended"
  | "no_candidate"
  | "failed";

export type TransitionId =
  | "begin_valid_evaluation"
  | "reject_invalid_input"
  | "return_ranked_candidates"
  | "return_no_candidate"
  | "reevaluate_after_recommendation"
  | "retry_after_empty_result"
  | "retry_after_failure";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export type Check = { ok: true } | { ok: false; reason: string };

export interface NormalizedNeedRecord {
  readonly kind: string;
  readonly target: string;
  readonly taskRevision: string;
  readonly proposalId: string;
  readonly evidenceRefs: readonly string[];
  readonly taxonomyVersion: string;
  readonly normalizedBy: string;
}

export interface CatalogPin {
  readonly version: string;
  readonly supportedKinds: readonly string[];
  readonly needKindMappings: Readonly<Record<string, readonly string[]>>;
}

export interface ContextPin {
  readonly taskRevision: string;
  readonly userPreferences: readonly string[];
  readonly catalogVersion?: string;
}

export interface BurdenAttribute {
  readonly name: string;
  readonly measurable: boolean;
  readonly value: number;
}

export interface InterruptionJustification {
  readonly targetUnresolved: boolean;
  readonly expectedBenefit: string;
  readonly urgencyRationale: string;
}

export interface AdaptationDeclaration {
  readonly replacesActive: boolean;
  readonly duringResponseEntry: boolean;
  readonly safetyRelated: boolean;
}

export interface PolicyCandidate {
  readonly id: string;
  /** Semantic contribution kind from the catalog — never a host widget name. */
  readonly kind: string;
  readonly requiredInputs: readonly string[];
  readonly availableInputs: readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly hostCapabilities: readonly string[];
  /** Names of applicable hard policy gates this candidate failed. */
  readonly failedHardGates: readonly string[];
  /** Declared score field — the primary ranking key. */
  readonly score: number;
  readonly burdenAttributes?: readonly BurdenAttribute[];
  readonly interruption?: InterruptionJustification;
  readonly adaptation?: AdaptationDeclaration;
}

export interface PolicyInput {
  readonly need: NormalizedNeedRecord;
  readonly policyVersion: string;
  readonly catalog: CatalogPin;
  readonly maxRecommendations: number;
  readonly candidates: readonly PolicyCandidate[];
  readonly context: ContextPin;
}

export interface Recommendation {
  readonly id: string;
  readonly kind: string;
  readonly score: number;
  readonly tieBreakKey: string;
}

export interface ExcludedCandidate {
  readonly id: string;
  readonly reasonCode: string;
}

export interface PolicyResult {
  readonly outcome: "recommended" | "no_candidate";
  readonly needIdentity: string;
  readonly policyVersion: string;
  readonly catalogVersion: string;
  readonly tieBreakRuleVersion: string;
  readonly rankingKeys: readonly string[];
  readonly recommendations: readonly Recommendation[];
  readonly exclusions: readonly ExcludedCandidate[];
  /** Measurable burden attributes that were ranking inputs, per recommended candidate id. */
  readonly burdenInfluence: Readonly<Record<string, readonly string[]>>;
  /** Uncertain inferred human-state attributes, recorded as advisory only. */
  readonly burdenAdvisory: Readonly<Record<string, readonly string[]>>;
}

export type EvaluationOutcome =
  | { readonly ok: true; readonly result: PolicyResult }
  | { readonly ok: false; readonly reason: string };

export interface AuthorizationRequest {
  readonly action: string;
  readonly scope: string;
  readonly taskRevision: string;
  readonly actor: string;
}
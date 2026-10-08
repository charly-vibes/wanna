// Purpose: vocabulary and record shapes for the cognitive-ergonomics layer
// Responsibilities: states, transition ids, adaptation/interruption/presentation records, guard subjects
// Rationale: measurable interaction attributes are typed separately from inferred human state,
//   which is always advisory — the type shapes carry the separation the spec demands
export type ErgonomicsState =
  | "baseline"
  | "candidate_adaptation"
  | "eligible"
  | "applied"
  | "deferred"
  | "reverted"
  | "blocked";

export type TransitionId =
  | "propose_adaptation"
  | "admit_stable_adaptation"
  | "block_disruptive_adaptation"
  | "apply_adaptation"
  | "defer_interruption"
  | "revert_adaptation";

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

export interface MeasurableTrigger {
  readonly metric: string;
  readonly value: number;
  readonly evidenceRef: string;
}

export interface InferredState {
  readonly attribute: string;
  readonly estimate: number;
  readonly uncertain: boolean;
  readonly evidenceRefs: readonly string[];
}

export type OverrideChannelKind = "revert" | "disable" | "stable_presentation";

export interface OverrideChannel {
  readonly kind: OverrideChannelKind;
  readonly available: boolean;
}

export interface AdaptationDesign {
  readonly adaptationId: string;
  readonly measurableTriggers: readonly MeasurableTrigger[];
  readonly inferredStates: readonly InferredState[];
  readonly replacesSurfaceDuringEntry: boolean;
  readonly safetyRequired: boolean;
  readonly userAccepted: boolean;
  readonly reason?: string;
  readonly override?: OverrideChannel;
}

export interface InterruptionClaim {
  readonly need?: string;
  readonly expectedBenefit?: string;
  readonly urgency?: string;
  readonly deferralRationale?: string;
}

export interface AdaptationRequest {
  readonly adaptation: AdaptationDesign;
  readonly interruption?: InterruptionClaim;
  readonly revertReason?: string;
}

export interface ExposedChoice {
  readonly label: string;
  readonly context: string;
}

export interface PresentationSpec {
  readonly surface: string;
  readonly exposes: readonly ExposedChoice[];
  readonly requiresRecallOf: readonly string[];
  readonly equivalentExposeAvailable: boolean;
  readonly feasible: boolean;
}

export interface OptionSet {
  readonly surface: string;
  readonly optionCount: number;
  readonly heterogeneous: boolean;
  readonly strategy?: string;
  readonly strategyDocumented: boolean;
}

export interface ActionPlacement {
  readonly host: string;
  readonly visualPlacement: string;
  readonly semanticIdAtHost: string;
}

export interface ActionIdentity {
  readonly semanticId: string;
  readonly frequentlyUsed: boolean;
  readonly consequential: boolean;
  readonly placements: readonly ActionPlacement[];
}

export interface ConfidenceSource {
  readonly metric: string;
  readonly semantics: string;
  readonly evidenceRefs: readonly string[];
}

export type GuardSubject =
  | { readonly kind: "inferred"; readonly attribute: string }
  | { readonly kind: "measurable"; readonly metric: string };

export interface RevertRecord {
  readonly adaptationId: string;
  readonly reason: string;
}

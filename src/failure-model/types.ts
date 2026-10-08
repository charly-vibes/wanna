// Purpose: vocabulary and record shapes for the failure model
// Responsibilities: failure states, transition ids, failure records, assessments, effect certainty, recoverability, retry safety
// Rationale: failure is ordinary runtime state — loss of acknowledgement never proves an external effect did not occur
export type Check = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };

export type FailureState =
  | "detected"
  | "contained"
  | "assessing"
  | "known"
  | "uncertain"
  | "resolved"
  | "escalated";

export type TransitionId =
  | "contain_failure"
  | "assess_failure"
  | "classify_known_failure"
  | "classify_uncertain_failure"
  | "resolve_known_failure"
  | "escalate_uncertain_failure";

export type EffectCertainty =
  | "no_effect"
  | "effect_applied"
  | "partial_effect"
  | "effect_unknown";

export type Recoverability =
  | "automatic"
  | "user_assisted"
  | "operator_assisted"
  | "compensatable"
  | "restart_only"
  | "unrecoverable_or_unknown";

export type RetrySafety =
  | "proven_idempotent"
  | "requires_reconciliation"
  | "prohibited_until_effect_state_known";

export type SeverityCategory = "low" | "medium" | "high" | "critical";

export type FailureClass =
  | "timeout"
  | "transport_failure"
  | "malformed_ai_proposal"
  | "invalid_plan"
  | "tool_loop"
  | "policy_violation"
  | "untrusted_generated_code"
  | "inaccessible_interaction"
  | "stale_revision"
  | "partial_transaction"
  | "conflicting_edit"
  | "user_mistake"
  | "infrastructure_failure";

export type FailureOrigin =
  | "host"
  | "generated"
  | "user"
  | "policy"
  | "infrastructure"
  | "transport";

export type FailureScope = "task" | "process" | "interaction" | "session" | "component";

/** Validated user input, drafts, and audit history preserved through containment. */
export interface PreservedUserWork {
  readonly validatedInput: readonly string[];
  readonly drafts: readonly string[];
  readonly auditHistory: readonly string[];
}

/** Provenance supplied by trusted ports: events, effects, tool identity, versions, timestamps. */
export interface FailureProvenance {
  readonly eventIds: readonly string[];
  readonly effectIds: readonly string[];
  readonly toolIdentity: string;
  readonly toolVersion: string;
  readonly timestamps: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface FailureRecord {
  readonly failureId: string;
  readonly failureClass: FailureClass;
  readonly origin: FailureOrigin;
  readonly scope: FailureScope;
  readonly severity: SeverityCategory;
  readonly affectedRevision: string;
  readonly evidence: readonly string[];
  readonly mutating: boolean;
  readonly userWork?: PreservedUserWork;
  readonly provenance?: FailureProvenance;
  readonly generated?: boolean;
}

export interface FailureAssessment {
  readonly effectCertainty: EffectCertainty;
  readonly recoverability: Recoverability;
  readonly retrySafety: RetrySafety;
  readonly reconciliationEvidence?: readonly string[];
}

export type FireArg =
  | { readonly kind: "record"; readonly record: FailureRecord }
  | { readonly kind: "assessment"; readonly assessment: FailureAssessment };

export type TransitionResult = Check;

export interface AppliedTransition {
  readonly id: TransitionId;
  readonly from: FailureState;
  readonly to: FailureState;
}

// Purpose: domain types for the interaction engine core
// Responsibilities: vocabulary for contexts, policies, candidates, decisions, machine
// Rationale: host-neutral per [[spec.host_neutral_types]] — no host/UI/io shapes here
export interface ContextSnapshot {
  readonly taskId: string;
  readonly taskRevision: number;
  readonly need: string;
  readonly catalogVersion: string;
  readonly policyVersion: string;
}

export interface Candidate {
  readonly id: string;
  readonly priority: number;
}

export interface Policy {
  readonly version: string;
  readonly candidates: readonly Candidate[];
}

export interface Exclusion {
  readonly id: string;
  readonly reasonCode: string;
}

export interface DecisionResult {
  readonly taskId: string;
  readonly taskRevision: number;
  readonly need: string;
  readonly catalogVersion: string;
  readonly policyVersion: string;
  /** Deterministic order: priority desc, id asc. */
  readonly candidates: readonly Candidate[];
  readonly exclusions: readonly Exclusion[];
}

export type EvaluationResult =
  | { readonly ok: true; readonly value: DecisionResult }
  | { readonly ok: false; readonly reason: string };

export type EngineState =
  | "draft"
  | "normalized"
  | "evaluated"
  | "committed"
  | "invalid_context"
  | "stale_context"
  | "retired";

export type TransitionId =
  | "accept_context"
  | "reject_invalid_context"
  | "correct_invalid_context"
  | "evaluate_pinned_context"
  | "commit_current_decision"
  | "reject_stale_decision"
  | "refresh_stale_context"
  | "retire_committed_decision";

export interface RecordedTransition {
  readonly id: TransitionId;
  readonly from: EngineState;
  readonly to: EngineState;
}

export type RetireCommand = { readonly kind: "retire" | "cancel" | "supersede" | "expire" };

export type TransitionResult = { readonly ok: true; readonly reason?: undefined } | { readonly ok: false; readonly reason: string };
// Purpose: vocabulary and record shapes for the interaction-runtime layer
// Responsibilities: contract/event/lifecycle vocabulary, envelope and committed-state records, model states, transition ids, typed failure and checkpoint records, persistence port
// Rationale: the runtime reduces validated events against committed state; every acceptance/rejection is explicit and typed
export const CONTRACT_VERSION = "interaction-runtime-contract-v1";
export const SCHEMA_VERSION = "interaction-state-schema-v1";
export const POLICY_VERSION = "interaction-policy-v1";

export const EVENT_TYPES = ["respond", "cancel", "dismiss", "expire", "supersede", "retire"] as const;

export type InteractionEventType = (typeof EVENT_TYPES)[number];

export type LifecycleEventType = Exclude<InteractionEventType, "respond">;

export const INTERACTION_KINDS = ["confirmation", "delegation", "question", "review"] as const;

export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export type RetiredOutcome = "cancelled" | "dismissed" | "expired" | "superseded" | "retired";

export const OUTCOME_OF: Readonly<Record<LifecycleEventType, RetiredOutcome>> = {
  cancel: "cancelled",
  dismiss: "dismissed",
  expire: "expired",
  supersede: "superseded",
  retire: "retired",
};

export const LIFECYCLE_PERMISSIONS: Readonly<Record<InteractionKind, readonly LifecycleEventType[]>> = {
  confirmation: ["cancel", "dismiss", "expire"],
  delegation: ["cancel", "supersede"],
  question: ["dismiss", "expire"],
  review: ["cancel", "dismiss", "expire", "supersede", "retire"],
};

export interface EventEnvelope {
  readonly eventId: string;
  readonly taskId: string;
  readonly interactionId: string;
  readonly eventType: string;
  readonly contractVersion: string;
  readonly interactionRevision: number;
  readonly taskRevision: number;
  readonly payload: unknown;
}

export interface ResponseRecord {
  readonly eventId: string;
  readonly payload: string;
}

export interface LifecycleRecord {
  readonly eventId: string;
  readonly outcome: RetiredOutcome;
}

export interface CommittedState {
  readonly taskId: string;
  readonly interactionId: string;
  readonly interactionKind: InteractionKind;
  readonly contractVersion: string;
  readonly interactionRevision: number;
  readonly taskRevision: number;
  readonly retired: boolean;
  readonly retiredOutcome: RetiredOutcome | null;
  readonly appliedEventIds: readonly string[];
  readonly responses: readonly ResponseRecord[];
  readonly outcomes: readonly LifecycleRecord[];
}

export type RuntimeState =
  | "active"
  | "validated"
  | "applied"
  | "malformed_event"
  | "rejected_commit"
  | "retired";

export type TransitionId =
  | "validate_envelope"
  | "reject_malformed_envelope"
  | "apply_current_event"
  | "reject_stale_or_duplicate"
  | "continue_after_apply"
  | "retry_with_corrected_event"
  | "retry_after_state_refresh"
  | "retire_interaction";

export type TransitionResult = { ok: true } | { ok: false; reason: string };

export type Check = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export type Reduction =
  | { readonly ok: true; readonly next: CommittedState; readonly transition: TransitionId }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly transition: TransitionId;
      readonly phase: "envelope" | "preconditions";
    };

export type EffectCertainty = "unknown" | "certain_no_effect" | "certain_effect";

export interface RuntimeFailure {
  readonly code: string;
  readonly eventId: string;
  readonly effectCertainty: EffectCertainty;
  readonly retryable: boolean;
  readonly detail: string;
}

export interface ReplayRecord {
  readonly initial: CommittedState;
  readonly events: readonly EventEnvelope[];
  readonly contractVersion: string;
  readonly policyVersion: string;
}

export type CommitResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly acknowledged: boolean; readonly error: string };

export interface PersistencePort {
  readonly name: string;
  readonly semantics: "atomic" | "weaker-declared";
  commit(state: CommittedState, record: ReplayRecord): CommitResult;
}

export interface ContinuityCheckpoint {
  readonly schemaVersion: string;
  readonly policyVersion: string;
  readonly interactionRevision: number;
  readonly taskRevision: number;
  readonly appliedEventIds: readonly string[];
  readonly retired: boolean;
  readonly reason: string;
}

export interface RenderProjection {
  readonly interactionId: string;
  readonly interactionKind: InteractionKind;
  revision: number;
  retired: boolean;
  retiredOutcome: RetiredOutcome | null;
  responses: ResponseRecord[];
  outcomes: LifecycleRecord[];
}

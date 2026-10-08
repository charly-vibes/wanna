// Purpose: vocabulary and record shapes for the contribution-primitives layer
// Responsibilities: primitive kinds, taxonomy version, escape vocabulary, proposal/event/escape records, state and transition types
// Rationale: primitives are semantic, host-free records — presentation controls and needs never leak into their identity
export const TAXONOMY_VERSION = "primitive-taxonomy-2026.10-provisional";

export const PRIMITIVE_KINDS = [
  "express", "provide", "constrain", "select", "order", "allocate",
  "inspect", "annotate", "edit", "evaluate", "verify", "correct",
  "delegate", "interrupt", "resume", "take_over", "authorize", "reject",
  "acknowledge", "defer", "cancel",
] as const;

export type PrimitiveKind = (typeof PRIMITIVE_KINDS)[number];

export const COMPOUND_ACTIVITIES = [
  "planning", "diagnosis", "review", "coordination", "monitoring", "clarification",
] as const;

export type CompoundActivity = (typeof COMPOUND_ACTIVITIES)[number];

export const ESCAPE_OUTCOMES = [
  "reject", "defer", "cancel", "dismiss", "no_response",
] as const;

export type EscapeOutcome = (typeof ESCAPE_OUTCOMES)[number];

export const ESCAPE_EFFECTS: Readonly<Record<EscapeOutcome, string>> = {
  reject: "the workflow rejects the contribution and remains at the requesting step",
  defer: "the workflow pauses and the request returns to the queue",
  cancel: "the workflow cancels the contribution without a substantive response",
  dismiss: "the workflow closes the prompt without a substantive response",
  no_response: "the workflow records silence and may re-prompt per policy",
};

export type EscapeDeclaration = Readonly<Partial<Record<EscapeOutcome, string>>>;

export interface PrimitiveProposal {
  readonly kind: string;
  readonly interactionId: string;
  readonly taskRevision: string;
  readonly provenance: readonly string[];
  readonly responsePayload?: unknown;
  readonly escapeDeclaration?: EscapeDeclaration;
}

export interface PrimitiveEvent {
  readonly kind: PrimitiveKind;
  readonly taxonomyVersion: string;
  readonly interactionId: string;
  readonly taskRevision: string;
  readonly payload: unknown;
  readonly provenance: readonly string[];
  readonly emittedBy: string;
}

export interface EscapeRecord {
  readonly kind: string;
  readonly outcome: EscapeOutcome;
  readonly workflowEffect: string;
  readonly responsePayload: undefined;
}

export interface PrimitiveDraft {
  readonly kind: string;
  readonly interactionId?: string;
  readonly taskRevision?: string;
  readonly payload?: unknown;
  readonly provenance?: readonly string[];
}

export interface TransitionArg {
  readonly escapeOutcome?: EscapeOutcome;
  readonly taxonomyRevision?: string;
}

export type PrimitiveState =
  | "proposed"
  | "validated"
  | "active"
  | "completed"
  | "escaped"
  | "invalid"
  | "retired";

export type TransitionId =
  | "validate_primitive"
  | "reject_invalid_primitive"
  | "activate_primitive"
  | "complete_primitive"
  | "escape_primitive"
  | "retire_primitive";

export type Check = { ok: true; reason?: undefined } | { ok: false; reason: string };

export type TransitionResult = { ok: true; reason?: undefined } | { ok: false; reason: string };
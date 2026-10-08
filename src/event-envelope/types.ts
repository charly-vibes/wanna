// Purpose: vocabulary and record shapes for the event-envelope layer
// Responsibilities: declared event types, rejection codes, envelope/context records, states, transitions, effect intents, payload bounds
// Rationale: envelopes are immutable facts crossing a boundary; every rejection class has a stable typed code
export const DECLARED_EVENT_TYPES = [
  "task.submitted",
  "interaction.opened",
  "interaction.resolved",
  "response.delivered",
  "effect.executed",
] as const;

export type EventType = (typeof DECLARED_EVENT_TYPES)[number];

export const RESULT_CODES = [
  "invalid_payload",
  "duplicate_event",
  "stale_revision",
  "unauthorized_source",
  "unsupported_event_type",
] as const;

export type ResultCode = (typeof RESULT_CODES)[number];

export interface EventEnvelope {
  readonly eventId: string;
  readonly eventType: string;
  readonly source: string;
  readonly sessionId: string;
  readonly taskId: string;
  readonly interactionId: string;
  readonly contractRevision: string;
  readonly expectedTaskRevision: string;
  readonly payload: unknown;
}

export interface EnvelopeContext {
  readonly committedEventIds: readonly string[];
  readonly currentTaskRevision: string;
  readonly authorizedSources: readonly string[];
}

export type EnvelopeState =
  | "received"
  | "validated"
  | "committed"
  | "duplicate"
  | "rejected"
  | "stale";

export type TransitionId =
  | "validate_event"
  | "reject_malformed_event"
  | "commit_event"
  | "ignore_duplicate"
  | "reject_stale_event";

export type EffectIntent = {
  readonly kind: "persist_event";
  readonly eventId: string;
  readonly eventType: string;
};

export type TransitionResult =
  | { ok: true; reason?: undefined; code?: undefined; effects: readonly EffectIntent[] }
  | { ok: false; reason: string; code?: ResultCode; effects?: undefined };

export type Check =
  | { readonly ok: true; readonly reason?: undefined; readonly code?: ResultCode }
  | { readonly ok: false; readonly reason: string; readonly code?: ResultCode };

export const PAYLOAD_BOUNDS = {
  maxBytes: 65536,
  maxNestingDepth: 8,
  maxStringLength: 4096,
  maxCollectionLength: 256,
  maxNumericMagnitude: 1e15,
} as const;
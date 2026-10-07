// Purpose: event-envelope state machine
// Responsibilities: the five transitions (validate, reject-malformed, commit, ignore-duplicate, reject-stale) with their guards
// Rationale: mirrors [[spec]] ## Model row for row; guards fail with exact reasons so negative tests can assert them
import { originCorrelated, payloadSchemaChecked } from "./schema";
import type {
  EffectIntent,
  EnvelopeContext,
  EnvelopeState,
  EventEnvelope,
  ResultCode,
  TransitionId,
  TransitionResult,
} from "./types";

export const ENVELOPE_VERSION = "event-envelope@1.0.0";

export interface TransitionRow {
  readonly id: TransitionId;
  readonly from: EnvelopeState;
  readonly to: EnvelopeState;
}

export const ENVELOPE_TRANSITIONS: readonly TransitionRow[] = [
  { id: "validate_event", from: "received", to: "validated" },
  { id: "reject_malformed_event", from: "received", to: "rejected" },
  { id: "commit_event", from: "validated", to: "committed" },
  { id: "ignore_duplicate", from: "validated", to: "duplicate" },
  { id: "reject_stale_event", from: "validated", to: "stale" },
];

export interface EnvelopeMachine {
  readonly envelope: EventEnvelope;
  readonly state: EnvelopeState;
  readonly rejectionReason: string | null;
  readonly rejectionCode: string | null;
  fire(id: TransitionId): TransitionResult;
}

interface Internals {
  state: EnvelopeState;
  rejectionReason: string | null;
  rejectionCode: string | null;
}

function fail(reason: string, code?: ResultCode): TransitionResult {
  return code === undefined ? { ok: false, reason } : { ok: false, reason, code };
}

function commitGuard(envelope: EventEnvelope, context: EnvelopeContext): TransitionResult {
  if (context.committedEventIds.includes(envelope.eventId)) {
    return fail(
      `event id ${envelope.eventId} is already committed — duplicate_idempotent forbids a second mutation or duplicate effect intent`,
      "duplicate_event",
    );
  }
  const origin = originCorrelated(envelope);
  if (!origin.ok) {
    return fail(`guard event_origin_correlated does not hold: ${origin.reason ?? "uncorrelated event"}`, "invalid_payload");
  }
  if (!context.authorizedSources.includes(envelope.source)) {
    return fail(`source ${envelope.source} is not authorized to commit events`, "unauthorized_source");
  }
  if (envelope.expectedTaskRevision !== context.currentTaskRevision) {
    return fail(
      `event is stale (expected task revision ${envelope.expectedTaskRevision}, current ${context.currentTaskRevision}) — route through reject_stale_event`,
      "stale_revision",
    );
  }
  return { ok: true, effects: [] };
}

function guardHolds(id: TransitionId, envelope: EventEnvelope, context: EnvelopeContext): TransitionResult {
  switch (id) {
    case "validate_event": {
      const check = payloadSchemaChecked(envelope);
      return check.ok ? { ok: true, effects: [] } : fail(check.reason ?? "malformed envelope", check.code);
    }
    case "reject_malformed_event": {
      const check = payloadSchemaChecked(envelope);
      return check.ok
        ? fail("guard payload_schema_checked holds — the envelope is not malformed", "invalid_payload")
        : { ok: true, effects: [] };
    }
    case "commit_event":
      return commitGuard(envelope, context);
    case "ignore_duplicate":
      return context.committedEventIds.includes(envelope.eventId)
        ? { ok: true, effects: [] }
        : fail(
            `event id ${envelope.eventId} is not in the committed registry — duplicate_idempotent does not hold`,
            "invalid_payload",
          );
    case "reject_stale_event":
      return envelope.expectedTaskRevision === context.currentTaskRevision
        ? fail(
            `guard stale_events_rejected holds — expected task revision ${context.currentTaskRevision} is current, nothing to reject as stale`,
            "stale_revision",
          )
        : { ok: true, effects: [] };
  }
}

function persistEffect(envelope: EventEnvelope): readonly EffectIntent[] {
  return [
    { kind: "persist_event", eventId: envelope.eventId, eventType: envelope.eventType },
  ];
}

function applyEffect(internals: Internals, id: TransitionId, envelope: EventEnvelope): readonly EffectIntent[] {
  if (id === "validate_event") {
    internals.state = "validated";
    return [];
  }
  if (id === "commit_event") {
    internals.state = "committed";
    return persistEffect(envelope);
  }
  if (id === "reject_malformed_event") {
    const check = payloadSchemaChecked(envelope);
    internals.state = "rejected";
    internals.rejectionReason = check.reason ?? "malformed envelope";
    internals.rejectionCode = check.code ?? "invalid_payload";
    return [];
  }
  internals.state = id === "ignore_duplicate" ? "duplicate" : "stale";
  return [];
}

function fireTransition(internals: Internals, id: TransitionId, envelope: EventEnvelope, context: EnvelopeContext): TransitionResult {
  const row = ENVELOPE_TRANSITIONS.find((r) => r.id === id);
  if (!row) return fail(`unknown transition ${id}`);
  if (internals.state !== row.from) {
    return fail(`transition ${id} cannot fire from state ${internals.state}`);
  }
  const guard = guardHolds(id, envelope, context);
  if (!guard.ok) return guard;
  return { ok: true, effects: applyEffect(internals, id, envelope) };
}

function makeMachine(internals: Internals, envelope: EventEnvelope, context: EnvelopeContext): EnvelopeMachine {
  return {
    get envelope() {
      return envelope;
    },
    get state() {
      return internals.state;
    },
    get rejectionReason() {
      return internals.rejectionReason;
    },
    get rejectionCode() {
      return internals.rejectionCode;
    },
    fire: (id) => fireTransition(internals, id, envelope, context),
  };
}

export function createEnvelopeMachine(envelope: EventEnvelope, context: EnvelopeContext): EnvelopeMachine {
  const internals: Internals = { state: "received", rejectionReason: null, rejectionCode: null };
  return makeMachine(internals, envelope, context);
}
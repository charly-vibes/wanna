// Purpose: the pure event-envelope reducer
// Responsibilities: reduce an envelope against a context to a new state plus effect intents, or a typed rejection
// Rationale: purity — no I/O, rendering, model calls, clock reads, or random generation ([[spec.reducer_pure]]);
//   duplicate ids produce no second mutation or duplicate effect intent; stale events are never silently applied
import { originCorrelated, payloadSchemaChecked } from "./schema";
import type { EffectIntent, EnvelopeContext, EnvelopeState, EventEnvelope, ResultCode } from "./types";

export type ReduceOutcome =
  | { ok: true; state: EnvelopeState; effects: readonly EffectIntent[] }
  | { ok: false; code: ResultCode; reason: string };

function persistEffect(envelope: EventEnvelope): readonly EffectIntent[] {
  return [
    { kind: "persist_event", eventId: envelope.eventId, eventType: envelope.eventType },
  ];
}

export function reduceEvent(envelope: EventEnvelope, context: EnvelopeContext): ReduceOutcome {
  const schema = payloadSchemaChecked(envelope);
  if (!schema.ok) {
    return { ok: false, code: schema.code ?? "invalid_payload", reason: schema.reason ?? "malformed envelope" };
  }
  if (context.committedEventIds.includes(envelope.eventId)) {
    return { ok: true, state: "duplicate", effects: [] };
  }
  const origin = originCorrelated(envelope);
  if (!origin.ok) {
    return { ok: false, code: "invalid_payload", reason: origin.reason ?? "uncorrelated event" };
  }
  if (!context.authorizedSources.includes(envelope.source)) {
    return {
      ok: false,
      code: "unauthorized_source",
      reason: `source ${envelope.source} is not authorized to commit events`,
    };
  }
  if (envelope.expectedTaskRevision !== context.currentTaskRevision) {
    return {
      ok: false,
      code: "stale_revision",
      reason: `expected task revision ${envelope.expectedTaskRevision} is stale (current ${context.currentTaskRevision}) — the event is never silently applied to the newer revision`,
    };
  }
  return { ok: true, state: "committed", effects: persistEffect(envelope) };
}
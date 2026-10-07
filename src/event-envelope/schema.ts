// Purpose: ingress schema and origin-correlation invariants for event envelopes
// Responsibilities: payload_schema_checked (schema shape + bounds) and event_origin_correlated checks
// Rationale: payloads validate against the declared schema before reducer invocation; every response
//   event identifies its originating session, task, interaction, contract revision, event, and expected task revision
import { payloadWithinBounds } from "./bounds";
import type { Check, EventEnvelope } from "./types";
import { DECLARED_EVENT_TYPES } from "./types";

const ORIGIN_FIELDS = [
  "sessionId",
  "taskId",
  "interactionId",
  "contractRevision",
  "eventId",
  "expectedTaskRevision",
] as const;

function isPlainObject(payload: unknown): payload is Record<string, unknown> {
  return payload !== null && typeof payload === "object" && !Array.isArray(payload);
}

export function payloadSchemaChecked(envelope: EventEnvelope): Check {
  if (typeof envelope.eventId !== "string" || envelope.eventId.length === 0) {
    return { ok: false, reason: "missing event id" };
  }
  if (!(DECLARED_EVENT_TYPES as readonly string[]).includes(envelope.eventType)) {
    return {
      ok: false,
      reason: `unsupported event type: ${envelope.eventType}`,
      code: "unsupported_event_type",
    };
  }
  if (!isPlainObject(envelope.payload)) {
    return { ok: false, reason: "payload must be a JSON object" };
  }
  return payloadWithinBounds(envelope.payload);
}

export function originCorrelated(envelope: EventEnvelope): Check {
  for (const field of ORIGIN_FIELDS) {
    const value = envelope[field];
    if (typeof value !== "string" || value.length === 0) {
      return { ok: false, reason: `missing origin correlation field: ${field}` };
    }
  }
  return { ok: true };
}
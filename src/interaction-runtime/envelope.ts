// Purpose: envelope validation for the interaction runtime
// Responsibilities: decide event_envelope_valid with a precise failure reason per defect
// Rationale: a malformed envelope must be rejected before any precondition or reduction can see it
import type { Check, EventEnvelope } from "./types";
import { CONTRACT_VERSION, EVENT_TYPES } from "./types";

function identityFieldsValid(event: EventEnvelope): Check {
  if (typeof event.eventId !== "string" || event.eventId.length === 0) {
    return { ok: false, reason: "missing event id" };
  }
  if (typeof event.taskId !== "string" || event.taskId.length === 0) {
    return { ok: false, reason: "missing task id" };
  }
  if (typeof event.interactionId !== "string" || event.interactionId.length === 0) {
    return { ok: false, reason: "missing interaction id" };
  }
  return { ok: true };
}

function eventTypeValid(event: EventEnvelope): Check {
  if (!(EVENT_TYPES as readonly string[]).includes(event.eventType)) {
    return { ok: false, reason: `unsupported event type: ${String(event.eventType)}` };
  }
  return { ok: true };
}

function contractVersionValid(event: EventEnvelope): Check {
  if (typeof event.contractVersion !== "string" || event.contractVersion.length === 0) {
    return { ok: false, reason: "missing contract version" };
  }
  if (event.contractVersion !== CONTRACT_VERSION) {
    return { ok: false, reason: `unsupported contract version: ${event.contractVersion}` };
  }
  return { ok: true };
}

function revisionFieldsValid(event: EventEnvelope): Check {
  if (typeof event.interactionRevision !== "number" || !Number.isInteger(event.interactionRevision) || event.interactionRevision < 0) {
    return { ok: false, reason: "missing interaction revision" };
  }
  if (typeof event.taskRevision !== "number" || !Number.isInteger(event.taskRevision) || event.taskRevision < 0) {
    return { ok: false, reason: "missing task revision precondition" };
  }
  return { ok: true };
}

function versionFieldsValid(event: EventEnvelope): Check {
  const type = eventTypeValid(event);
  if (!type.ok) return type;
  const contract = contractVersionValid(event);
  if (!contract.ok) return contract;
  return revisionFieldsValid(event);
}

function payloadValid(event: EventEnvelope): Check {
  if (event.payload === undefined || event.payload === null) {
    return { ok: false, reason: "missing validated payload" };
  }
  if (event.eventType === "respond" && (typeof event.payload !== "string" || event.payload.length === 0)) {
    return { ok: false, reason: "validated payload must be a non-empty response string" };
  }
  return { ok: true };
}

export function envelopeValid(event: EventEnvelope | undefined): Check {
  if (!event) return { ok: false, reason: "no event supplied" };
  const identity = identityFieldsValid(event);
  if (!identity.ok) return identity;
  const versions = versionFieldsValid(event);
  if (!versions.ok) return versions;
  return payloadValid(event);
}
